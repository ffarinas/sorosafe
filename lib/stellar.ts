import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { env } from "cloudflare:workers";
import { NETWORKS } from "./network";
import { decimal, units, pendingAmount } from "./assets";
import type { Balance, Payment } from "./domain";
if (env.JUNTO_NETWORK && !["mainnet", "testnet"].includes(env.JUNTO_NETWORK))
  throw new Error("NETWORK_UNAVAILABLE");
export const chain = NETWORKS[env.JUNTO_NETWORK || "mainnet"];
export const NETWORK = chain.passphrase;
export const HORIZON = chain.horizon;
export type ChainAccount = {
  id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring: number;
  num_sponsored: number;
  balances: {
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
    is_authorized?: boolean;
    selling_liabilities: string;
  }[];
  signers: { key: string; weight: number; type: string }[];
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
};
export async function networkRules() {
  const r = await fetch(`${HORIZON}/ledgers?order=desc&limit=1`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("NETWORK_UNAVAILABLE");
  const data = (await r.json()) as {
    _embedded: {
      records: {
        base_reserve_in_stroops: number;
        base_fee_in_stroops: number;
        closed_at: string;
      }[];
    };
  };
  const ledger = data._embedded?.records?.[0];
  if (
    !ledger ||
    !Number.isSafeInteger(ledger.base_reserve_in_stroops) ||
    ledger.base_reserve_in_stroops <= 0 ||
    !Number.isSafeInteger(ledger.base_fee_in_stroops) ||
    ledger.base_fee_in_stroops <= 0
  )
    throw new Error("NETWORK_UNAVAILABLE");
  return {
    closedAt: Math.floor(Date.parse(ledger.closed_at) / 1000),
    reserve: BigInt(ledger.base_reserve_in_stroops),
    fee: BigInt(ledger.base_fee_in_stroops),
  };
}
export function accountBalances(
  a: ChainAccount,
  rules: { reserve: bigint; fee: bigint },
  payments: Payment[] = [],
): Balance[] {
  const entries = 2 + a.subentry_count + a.num_sponsoring - a.num_sponsored;
  if (!Number.isSafeInteger(entries) || entries < 0)
    throw new Error("NETWORK_UNAVAILABLE");
  const reserve = BigInt(entries) * rules.reserve;
  const pendingFees = payments
    .filter((p) => ["pending", "submitting"].includes(p.status))
    .reduce((sum, p) => sum + units(p.fee), BigInt(0));
  const pendingReserve =
    BigInt(
      payments.filter(
        (p) =>
          p.kind === "enable" && ["pending", "submitting"].includes(p.status),
      ).length,
    ) * rules.reserve;
  return a.balances
    .filter(
      (b) =>
        b.asset_type === "native" ||
        b.asset_type === "credit_alphanum4" ||
        b.asset_type === "credit_alphanum12",
    )
    .map((b) => {
      const native = b.asset_type === "native";
      const identity = {
        code: native ? "XLM" : b.asset_code!,
        issuer: native ? "" : b.asset_issuer!,
      };
      const liabilities = units(b.selling_liabilities);
      const allocated = pendingAmount(identity, payments);
      const authorized = native || b.is_authorized === true;
      return {
        ...identity,
        balance: b.balance,
        authorized,
        reserve: decimal(native ? reserve : BigInt(0)),
        liabilities: decimal(liabilities),
        pending: decimal(allocated),
        available: decimal(
          authorized
            ? units(b.balance) -
                liabilities -
                allocated -
                (native
                  ? reserve + pendingReserve + pendingFees + rules.fee
                  : BigInt(0))
            : BigInt(0),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(!!a.issuer) - Number(!!b.issuer) ||
        a.code.localeCompare(b.code) ||
        a.issuer.localeCompare(b.issuer),
    );
}
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
  fee: string,
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
    fee,
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
