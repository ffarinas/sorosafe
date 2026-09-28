import {
  Account,
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
export const NETWORK = Networks.TESTNET;
export const HORIZON = "https://horizon-testnet.stellar.org";
export type ChainAccount = {
  id: string;
  sequence: string;
  balances: {
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
    is_authorized?: boolean;
  }[];
  signers: { key: string; weight: number; type: string }[];
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
};
export async function account(address: string): Promise<ChainAccount> {
  const r = await fetch(`${HORIZON}/accounts/${address}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 404 ? "ACCOUNT_MISSING" : "NETWORK_UNAVAILABLE",
    );
  return r.json();
}
export function decode(encoded: string) {
  const tx = TransactionBuilder.fromXDR(encoded, NETWORK);
  if (!(tx instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
  return tx;
}
export function signedBy(original: string, signed: string, address: string) {
  const tx = decode(original),
    candidate = decode(signed);
  if (
    Buffer.from(tx.hash()).toString("hex") !==
    Buffer.from(candidate.hash()).toString("hex")
  )
    throw new Error("CHANGED_TRANSACTION");
  const key = Keypair.fromPublicKey(address);
  const sig = candidate.signatures.find(
    (s) =>
      Buffer.from(s.hint.value).equals(Buffer.from(key.signatureHint())) &&
      key.verify(tx.hash(), s.signature),
  );
  if (!sig) throw new Error("INVALID_SIGNATURE");
  return sig.toXDR("base64");
}
export function checkPolicy(
  a: ChainAccount,
  members: string[],
  threshold: number,
) {
  const positive = a.signers.filter((s) => s.weight > 0);
  return (
    positive.length === members.length &&
    positive.every(
      (s) =>
        s.type === "ed25519_public_key" &&
        s.weight === 1 &&
        members.includes(s.key),
    ) &&
    !positive.some((s) => s.key === a.id) &&
    Object.values(a.thresholds).every((v) => v === threshold)
  );
}
export function setupXdr(
  a: ChainAccount,
  members: string[],
  threshold: number,
) {
  if (
    members.length < 2 ||
    members.length > 20 ||
    new Set(members).size !== members.length ||
    threshold < 2 ||
    threshold > members.length
  )
    throw new Error("INVALID_RULE");
  let b = new TransactionBuilder(new Account(a.id, a.sequence), {
    fee: "100",
    networkPassphrase: NETWORK,
  });
  for (const key of members)
    b = b.addOperation(
      Operation.setOptions({ signer: { ed25519PublicKey: key, weight: 1 } }),
    );
  return b
    .addOperation(
      Operation.setOptions({
        masterWeight: 0,
        lowThreshold: threshold,
        medThreshold: threshold,
        highThreshold: threshold,
      }),
    )
    .setTimeout(600)
    .build()
    .toXDR();
}
export function paymentXdr(
  a: ChainAccount,
  destination: string,
  amount: string,
  code: string,
  issuer: string,
  memo: string,
  expires: number,
) {
  if (
    !/^\d+(\.\d{1,7})?$/.test(amount) ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    Number(amount) > 1000000000
  )
    throw new Error("INVALID_AMOUNT");
  if (Buffer.byteLength(memo, "utf8") > 28) throw new Error("MEMO_TOO_LONG");
  const asset = issuer ? new Asset(code, issuer) : Asset.native();
  let b = new TransactionBuilder(new Account(a.id, a.sequence), {
    fee: "100",
    networkPassphrase: NETWORK,
    timebounds: { minTime: 0, maxTime: expires },
  }).addOperation(Operation.payment({ destination, asset, amount }));
  if (memo) b = b.addMemo(Memo.text(memo));
  return b.build().toXDR();
}
export function combine(
  encoded: string,
  signatures: string[],
  threshold: number,
) {
  const tx = decode(encoded);
  for (const sig of signatures.slice(0, threshold))
    tx.signatures.push(xdr.DecoratedSignature.fromXDR(sig, "base64"));
  return tx.toXDR();
}
export async function receipt(
  hash: string,
): Promise<{ successful: boolean; hash: string } | null> {
  const r = await fetch(`${HORIZON}/transactions/${hash}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("NETWORK_UNAVAILABLE");
  return r.json();
}
export async function submit(encoded: string) {
  const r = await fetch(`${HORIZON}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: encoded }),
    signal: AbortSignal.timeout(25000),
  });
  const result = (await r.json()) as {
    successful?: boolean;
    hash?: string;
    extras?: { result_codes?: { transaction: string; operations?: string[] } };
  };
  if (!r.ok) {
    const codes = result.extras?.result_codes;
    throw new Error(
      codes?.transaction === "tx_bad_auth"
        ? "INSUFFICIENT_SIGNATURES"
        : codes?.transaction === "tx_bad_seq"
          ? "STALE_PAYMENT"
          : codes?.operations?.includes("op_underfunded")
            ? "INSUFFICIENT_FUNDS"
            : codes?.operations?.includes("op_no_trust")
              ? "TRUSTLINE_REQUIRED"
              : "SUBMISSION_UNCERTAIN",
    );
  }
  return result;
}
