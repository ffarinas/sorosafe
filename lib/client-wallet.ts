import type { Keypair } from "@stellar/stellar-sdk";
import type { Payment } from "./domain";
let temporaryKey: Keypair | undefined;
const temporaryMarker = "junto-temporary-address";
export function temporaryWalletStatus(
  address: string,
): "active" | "lost" | "none" {
  if (temporaryKey?.publicKey() === address) return "active";
  return sessionStorage.getItem(temporaryMarker) === address ? "lost" : "none";
}
export async function connectWallet(temporary = false) {
  if (temporary) {
    const { Keypair } = await import("@stellar/stellar-sdk");
    temporaryKey = Keypair.random();
    sessionStorage.setItem(temporaryMarker, temporaryKey.publicKey());
    return temporaryKey.publicKey();
  }
  const f = await import("@stellar/freighter-api");
  const connected = await f.isConnected();
  if (!connected.isConnected) throw new Error("INSTALL_FREIGHTER");
  const r = await f.requestAccess();
  if (r.error || !r.address) throw new Error("WALLET_CANCELLED");
  temporaryKey = undefined;
  sessionStorage.removeItem(temporaryMarker);
  return r.address;
}
export async function signXdr(xdr: string, address: string) {
  const { TransactionBuilder, Networks, Transaction } =
    await import("@stellar/stellar-sdk");
  if (temporaryKey?.publicKey() === address) {
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    if (!(tx instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
    tx.sign(temporaryKey);
    return tx.toXDR();
  }
  if (temporaryWalletStatus(address) === "lost")
    throw new Error("TEST_WALLET_GONE");
  const f = await import("@stellar/freighter-api");
  const network = await f.getNetworkDetails();
  if (network.networkPassphrase !== Networks.TESTNET)
    throw new Error("TESTNET_REQUIRED");
  const r = await f.signTransaction(xdr, {
    address,
    networkPassphrase: Networks.TESTNET,
  });
  if (r.error || !r.signedTxXdr || r.signerAddress !== address)
    throw new Error("WALLET_CANCELLED");
  return r.signedTxXdr;
}
export async function loginWithWallet(address: string, name: string) {
  const { Networks, WebAuth, StrKey } = await import("@stellar/stellar-sdk");
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
    c.network_passphrase !== Networks.TESTNET
  )
    throw new Error("INVALID_LOGIN");
  try {
    const { tx, clientAccountID } = WebAuth.readChallengeTx(
      c.transaction,
      key,
      Networks.TESTNET,
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
  const signed = await signXdr(c.transaction, address);
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signed, name }),
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error || "INVALID_LOGIN");
  }
  // The server sets an HttpOnly cookie; never persist the response JWT in JS.
}
export async function assertPayment(p: Payment, source: string) {
  const { TransactionBuilder, Networks, Transaction } =
    await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(p.xdr, Networks.TESTNET);
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
  if (
    hash !== p.hash ||
    op.type !== "payment" ||
    (op.source && op.source !== source) ||
    (op.type === "payment" &&
      (op.destination !== p.destination ||
        Number(op.amount) !== Number(p.amount) ||
        op.asset.getCode() !== p.code ||
        (op.asset.isNative() ? "" : op.asset.getIssuer()) !== p.issuer)) ||
    memo !== p.memo ||
    !["none", "text"].includes(tx.memo.type) ||
    Number(tx.timeBounds?.maxTime) !== p.expires
  )
    throw new Error("CHANGED_TRANSACTION");
}
export async function bootstrapVault(
  prepare: (address: string) => Promise<{ xdr: string }>,
  complete: (signed: string) => Promise<unknown>,
) {
  const { Keypair, TransactionBuilder, Transaction, Networks } =
    await import("@stellar/stellar-sdk");
  const key = Keypair.random();
  const r = await fetch(
    `https://friendbot.stellar.org/?addr=${key.publicKey()}`,
  );
  if (!r.ok) throw new Error("NETWORK_UNAVAILABLE");
  const { xdr } = await prepare(key.publicKey());
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  if (!(tx instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
  tx.sign(key);
  await complete(tx.toXDR());
}
export function disconnectWallet() {
  temporaryKey = undefined;
  sessionStorage.removeItem(temporaryMarker);
}
