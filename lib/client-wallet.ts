import type { Keypair } from "@stellar/stellar-sdk";
import type { Payment, Activation, Person, Vault } from "./domain";
import type { NetworkConfig } from "./network";
import { units, TRUST_LIMIT } from "./assets";
let temporaryKey: Keypair | undefined;
const temporaryMarker = "junto-temporary-address";
// Testnet only, test funds only: the key survives a reload of this tab so a
// refresh never locks someone out of their trial vault. Closing the tab
// (sessionStorage) still discards it.
const temporarySecret = "junto-temporary-secret";
export function temporaryWalletStatus(
  address: string,
): "active" | "lost" | "none" {
  if (temporaryKey?.publicKey() === address) return "active";
  if (sessionStorage.getItem(temporaryMarker) !== address) return "none";
  return sessionStorage.getItem(temporarySecret) ? "active" : "lost";
}
/** Testnet only: a new wallet gets free test XLM so it can pay network fees. */
export async function ensureTestFunds(address: string, network: NetworkConfig) {
  if (network.id !== "testnet") return;
  const known = await fetch(`${network.horizon}/accounts/${address}`);
  if (known.ok) return;
  const funded = await fetch("https://friendbot.stellar.org?addr=" + address);
  if (!funded.ok) throw new Error("ACCOUNT_MISSING");
}
export async function connectWallet(temporary = false, network: NetworkConfig) {
  if (temporary) {
    if (network.id !== "testnet") throw new Error("NETWORK_MISMATCH");
    const { Keypair } = await import("@stellar/stellar-sdk");
    temporaryKey = Keypair.random();
    sessionStorage.setItem(temporaryMarker, temporaryKey.publicKey());
    sessionStorage.setItem(temporarySecret, temporaryKey.secret());
    return temporaryKey.publicKey();
  }
  const f = await import("@stellar/freighter-api");
  const connected = await f.isConnected();
  if (!connected.isConnected) throw new Error("INSTALL_FREIGHTER");
  const r = await f.requestAccess();
  if (r.error || !r.address) throw new Error("WALLET_CANCELLED");
  temporaryKey = undefined;
  sessionStorage.removeItem(temporaryMarker);
  sessionStorage.removeItem(temporarySecret);
  return r.address;
}
export async function signXdr(
  xdr: string,
  address: string,
  chain: NetworkConfig,
) {
  const { TransactionBuilder, Transaction, Keypair } =
    await import("@stellar/stellar-sdk");
  const saved = sessionStorage.getItem(temporarySecret);
  if (
    !temporaryKey &&
    saved &&
    chain.id === "testnet" &&
    sessionStorage.getItem(temporaryMarker) === address
  )
    temporaryKey = Keypair.fromSecret(saved);
  if (temporaryKey?.publicKey() === address) {
    if (chain.id !== "testnet") throw new Error("NETWORK_MISMATCH");
    const tx = TransactionBuilder.fromXDR(xdr, chain.passphrase);
    if (!(tx instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
    tx.sign(temporaryKey);
    return tx.toXDR();
  }
  if (temporaryWalletStatus(address) === "lost")
    throw new Error("TEST_WALLET_GONE");
  const f = await import("@stellar/freighter-api");
  const network = await f.getNetworkDetails();
  if (network.networkPassphrase !== chain.passphrase)
    throw new Error(
      chain.id === "mainnet" ? "MAINNET_REQUIRED" : "TESTNET_REQUIRED",
    );
  const r = await f.signTransaction(xdr, {
    address,
    networkPassphrase: chain.passphrase,
  });
  if (r.error || !r.signedTxXdr || r.signerAddress !== address)
    throw new Error("WALLET_CANCELLED");
  return r.signedTxXdr;
}
export async function loginWithWallet(
  address: string,
  name: string | undefined,
  chain: NetworkConfig,
) {
  const { WebAuth, StrKey } = await import("@stellar/stellar-sdk");
  const [infoResponse, challengeResponse] = await Promise.all([
    fetch("/.well-known/stellar.toml", { cache: "no-store" }),
    fetch(`/api/auth?account=${encodeURIComponent(address)}`, {
      cache: "no-store",
    }),
  ]);
  if (!infoResponse.ok) throw new Error("AUTH_UNAVAILABLE");
  const info = await infoResponse.text();
  const key = info.match(/^SIGNING_KEY="([A-Z2-7]+)"$/m)?.[1];
  const endpoint = info.match(/^WEB_AUTH_ENDPOINT="([^"]+)"$/m)?.[1];
  const c = (await challengeResponse.json()) as {
    transaction: string;
    network_passphrase: string;
    error?: string;
  };
  if (!challengeResponse.ok) throw new Error(c.error || "INVALID_LOGIN");
  if (
    !key ||
    !StrKey.isValidEd25519PublicKey(key) ||
    endpoint !== `${location.origin}/api/auth` ||
    c.network_passphrase !== chain.passphrase
  )
    throw new Error("INVALID_LOGIN");
  try {
    const { tx, clientAccountID } = WebAuth.readChallengeTx(
      c.transaction,
      key,
      chain.passphrase,
      location.host,
      location.host,
    );
    if (
      clientAccountID !== address ||
      tx.signatures.length !== 1 ||
      tx.operations.length !== 2 ||
      tx.operations[1].type !== "manageData" ||
      tx.operations[1].name !== "web_auth_domain"
    )
      throw new Error("INVALID_LOGIN");
  } catch {
    throw new Error("INVALID_LOGIN");
  }
  const signed = await signXdr(c.transaction, address, chain);
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Omitting the name keeps the one an existing account already has.
    body: JSON.stringify(
      name ? { transaction: signed, name } : { transaction: signed },
    ),
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error || "INVALID_LOGIN");
  }
  // The server sets an HttpOnly cookie; never persist the response JWT in JS.
}
export async function assertPayment(
  p: Payment,
  source: string,
  chain: NetworkConfig,
) {
  const { TransactionBuilder, Transaction, Asset } =
    await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(p.xdr, chain.passphrase);
  if (
    !(tx instanceof Transaction) ||
    tx.source !== source ||
    tx.operations.length !== 1 ||
    tx.signatures.length !== 0
  )
    throw new Error("CHANGED_TRANSACTION");
  const op = tx.operations[0];
  const hash = Array.from(tx.hash(), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const memo =
    tx.memo.type === "text"
      ? typeof tx.memo.value === "string"
        ? tx.memo.value
        : new TextDecoder().decode(tx.memo.value as Uint8Array)
      : "";
  const matches =
    p.kind === "enable"
      ? op.type === "changeTrust" &&
        op.line instanceof Asset &&
        op.line.getCode() === p.code &&
        op.line.getIssuer() === p.issuer &&
        op.limit === TRUST_LIMIT &&
        p.destination === source &&
        memo === ""
      : op.type === "payment" &&
        op.destination === p.destination &&
        units(op.amount) === units(p.amount) &&
        op.asset.getCode() === p.code &&
        (op.asset.isNative() ? "" : op.asset.getIssuer()) === p.issuer;
  if (
    hash !== p.hash ||
    !matches ||
    (op.source && op.source !== source) ||
    memo !== p.memo ||
    !["none", "text"].includes(tx.memo.type) ||
    BigInt(tx.fee) !== units(p.fee) ||
    Number(tx.timeBounds?.maxTime) !== p.expires
  )
    throw new Error("CHANGED_TRANSACTION");
}
export async function assertActivation(
  quote: Activation,
  vault: Vault,
  people: Person[],
  chain: NetworkConfig,
  expectedFactory?: string,
) {
  if (vault.custody === "soroban") {
    const { assertCall, createArgs, readContract, verifyCode } =
      await import("./contracts");
    if (
      quote.kind !== "soroban" ||
      !expectedFactory ||
      quote.factory !== expectedFactory ||
      !quote.salt ||
      !/^[a-f0-9]{64}$/.test(quote.salt)
    )
      throw new Error("CHANGED_TRANSACTION");
    const salt = Uint8Array.from(quote.salt.match(/../g)!, (b) =>
      parseInt(b, 16),
    );
    assertCall(
      quote.xdr,
      chain,
      vault.owner,
      expectedFactory,
      "create",
      createArgs(vault.owner, salt, vault.name, {
        signers: people.map((p) => p.address),
        threshold: vault.threshold,
      }),
    );
    await verifyCode(chain, expectedFactory, "factory");
    const protocol = await readContract<import("./contracts").FactoryConfig>(
      chain,
      expectedFactory,
      "config",
    );
    if (
      protocol.protocol.fee_bps !== quote.feeBps ||
      protocol.protocol.collector !== quote.collector
    )
      throw new Error("CHANGED_TRANSACTION");
    return;
  }
  const { TransactionBuilder, Transaction, Keypair } =
    await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(quote.xdr, chain.passphrase);
  if (
    !(tx instanceof Transaction) ||
    tx.source !== vault.owner ||
    tx.operations.length !== people.length + 2 ||
    tx.memo.type !== "none" ||
    tx.signatures.length !== 1 ||
    BigInt(tx.fee) !== units(quote.fee) ||
    Number(tx.timeBounds?.maxTime) !== quote.expires ||
    quote.expires <= Date.now() / 1000
  )
    throw new Error("CHANGED_TRANSACTION");
  const create = tx.operations[0];
  if (
    create.type !== "createAccount" ||
    create.source ||
    create.destination !== quote.address ||
    units(create.startingBalance) !== units(quote.funding)
  )
    throw new Error("CHANGED_TRANSACTION");
  for (let index = 0; index < people.length; index++) {
    const op = tx.operations[index + 1];
    if (
      op.type !== "setOptions" ||
      op.source !== quote.address ||
      !op.signer ||
      !("ed25519PublicKey" in op.signer) ||
      op.signer.ed25519PublicKey !== people[index].address ||
      op.signer.weight !== 1 ||
      Object.entries(op).some(
        ([k, value]) =>
          value !== undefined && !["type", "source", "signer"].includes(k),
      )
    )
      throw new Error("CHANGED_TRANSACTION");
  }
  const policy = tx.operations[tx.operations.length - 1];
  if (
    policy.type !== "setOptions" ||
    policy.source !== quote.address ||
    policy.masterWeight !== 0 ||
    policy.lowThreshold !== vault.threshold ||
    policy.medThreshold !== vault.threshold ||
    policy.highThreshold !== vault.threshold ||
    Object.entries(policy).some(
      ([k, value]) =>
        value !== undefined &&
        ![
          "type",
          "source",
          "masterWeight",
          "lowThreshold",
          "medThreshold",
          "highThreshold",
        ].includes(k),
    )
  )
    throw new Error("CHANGED_TRANSACTION");
  if (
    !Keypair.fromPublicKey(quote.address).verify(
      tx.hash(),
      tx.signatures[0].signature,
    )
  )
    throw new Error("CHANGED_TRANSACTION");
}

export function disconnectWallet() {
  temporaryKey = undefined;
  sessionStorage.removeItem(temporaryMarker);
  sessionStorage.removeItem(temporarySecret);
}
