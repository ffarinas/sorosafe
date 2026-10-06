import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { env } from "cloudflare:workers";
import { NETWORKS } from "./network";
if (env.JUNTO_NETWORK && !["mainnet", "testnet"].includes(env.JUNTO_NETWORK))
  throw new Error("NETWORK_UNAVAILABLE");
export const chain = NETWORKS[env.JUNTO_NETWORK || "mainnet"];
export const NETWORK = chain.passphrase;
export const HORIZON = chain.horizon;
/** The parts of a Horizon account that sign-in checks (SEP-10 thresholds). */
export type ChainAccount = {
  id: string;
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
/** Checks that `signed` is exactly `original`, signed by `address`. */
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
