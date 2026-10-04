/** Stateless Soroban client. Also used by the independent /contract screen. */
import {
  Account,
  Address,
  Asset,
  Contract,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
  type Keypair,
} from "@stellar/stellar-sdk";
import artifacts from "./contract-artifacts.json";
import type { NetworkConfig } from "./network";
import { assetCatalog, decimal, units } from "./assets";
export type Rules = { signers: string[]; threshold: number };
export type Protocol = { collector: string; fee_bps: number; assets: string[] };
export type ContractConfig = {
  factory: string;
  name: string;
  rules: Rules;
  protocol: Protocol;
  epoch: number;
  next_id: bigint;
};
export type ContractAction =
  ["Pay", string, string, bigint] | ["ChangeRules", Rules];
export type ContractProposal = {
  id: bigint;
  epoch: number;
  proposer: string;
  action: ContractAction;
  approvals: string[];
  expires: bigint;
  created: bigint;
  status: number;
  fee: bigint;
};
export type FactoryConfig = { wasm_hash: Uint8Array; protocol: Protocol };
export const val = {
  address: (s: string) => new Address(s).toScVal(),
  u64: (n: bigint) => nativeToScVal(n, { type: "u64" }),
  u32: (n: number) => nativeToScVal(n, { type: "u32" }),
  i128: (n: bigint) => nativeToScVal(n, { type: "i128" }),
  string: (s: string) => nativeToScVal(s, { type: "string" }),
};
export function structVal(fields: Record<string, xdr.ScVal>) {
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map(
        (key) =>
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol(key),
            val: fields[key],
          }),
      ),
  );
}
export function rulesVal(rules: Rules) {
  if (
    rules.signers.length < 1 ||
    rules.signers.length > 20 ||
    new Set(rules.signers).size !== rules.signers.length ||
    rules.signers.some((s) => !StrKey.isValidEd25519PublicKey(s)) ||
    !Number.isInteger(rules.threshold) ||
    rules.threshold < 1 ||
    rules.threshold > rules.signers.length
  )
    throw new Error("INVALID_RULE");
  return structVal({
    signers: xdr.ScVal.scvVec(rules.signers.map(val.address)),
    threshold: val.u32(rules.threshold),
  });
}
export function actionVal(action: ContractAction) {
  return xdr.ScVal.scvVec(
    action[0] === "Pay"
      ? [
          xdr.ScVal.scvSymbol("Pay"),
          val.address(action[1]),
          val.address(action[2]),
          val.i128(action[3]),
        ]
      : [xdr.ScVal.scvSymbol("ChangeRules"), rulesVal(action[1])],
  );
}
export const sacId = (chain: NetworkConfig, code: string, issuer: string) =>
  (issuer ? new Asset(code, issuer) : Asset.native()).contractId(
    chain.passphrase,
  );
export function contractAssets(chain: NetworkConfig) {
  return [
    {
      code: "XLM",
      issuer: "",
      issuerName: "Stellar",
      logo: "/assets/xlm.svg",
      source: "https://stellar.org",
    },
    ...assetCatalog(chain.id),
  ].map((asset) => ({
    ...asset,
    contract: sacId(chain, asset.code, asset.issuer),
  }));
}
export async function server(chain: NetworkConfig) {
  const s = new rpc.Server(chain.rpc, { timeout: 20000 });
  const network = await s.getNetwork();
  if (network.passphrase !== chain.passphrase)
    throw new Error("NETWORK_MISMATCH");
  return s;
}
export async function readContract<T>(
  chain: NetworkConfig,
  address: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  if (!StrKey.isValidContract(address)) throw new Error("INVALID_ADDRESS");
  // A read-only simulation needs a syntactic source account, not a key or funds.
  const source = new Account(
    StrKey.encodeEd25519PublicKey(new Uint8Array(32)),
    "0",
  );
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: chain.passphrase,
  })
    .addOperation(new Contract(address).call(method, ...args))
    .setTimeout(60)
    .build();
  const s = await server(chain);
  const result = await s.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result)
    throw new Error("CONTRACT_UNAVAILABLE");
  return scValToNative(result.result.retval) as T;
}
export async function prepareCall(
  chain: NetworkConfig,
  signer: string,
  address: string,
  method: string,
  args: xdr.ScVal[],
) {
  const s = await server(chain);
  const source = await s.getAccount(signer);
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: chain.passphrase,
  })
    .addOperation(new Contract(address).call(method, ...args))
    .setTimeout(300)
    .build();
  const result = await s.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result)
    throw new Error("CONTRACT_REJECTED", { cause: result });
  // All v1 user authorization must come from this transaction's source. Never
  // ask the user to sign arbitrary auth payloads returned by an RPC provider.
  for (const auth of result.result.auth ?? []) {
    if (auth.credentials.type !== "sorobanCredentialsSourceAccount")
      throw new Error("UNEXPECTED_AUTHORIZATION");
  }
  const assembled = rpc.assembleTransaction(tx, result).build();
  const quote = {
    xdr: assembled.toXDR(),
    fee: decimal(BigInt(assembled.fee)),
    expires: Number(assembled.timeBounds?.maxTime),
    result: scValToNative(result.result.retval) as unknown,
  };
  assertCall(quote.xdr, chain, signer, address, method, args);
  return quote;
}
export function assertCall(
  encoded: string,
  chain: NetworkConfig,
  signer: string,
  contract: string,
  method: string,
  args: xdr.ScVal[],
) {
  const tx = TransactionBuilder.fromXDR(encoded, chain.passphrase);
  if (
    !(tx instanceof Transaction) ||
    tx.source !== signer ||
    tx.operations.length !== 1 ||
    tx.memo.type !== "none"
  )
    throw new Error("CHANGED_TRANSACTION");
  const op = tx.operations[0];
  if (
    op.type !== "invokeHostFunction" ||
    op.source ||
    op.func.type !== "hostFunctionTypeInvokeContract"
  )
    throw new Error("CHANGED_TRANSACTION");
  const call = op.func.invokeContract;
  if (
    Address.fromScAddress(call.contractAddress).toString() !== contract ||
    call.functionName.toString() !== method ||
    call.args.length !== args.length ||
    call.args.some((a, i) => a.toXDR("base64") !== args[i].toXDR("base64"))
  )
    throw new Error("CHANGED_TRANSACTION");
  // Contract/amount/recipient/rules come from local intent, never a server quote.
  if (
    !tx.timeBounds ||
    Number(tx.timeBounds.maxTime) <= Date.now() / 1000 ||
    BigInt(tx.fee) > units(chain.id === "testnet" ? "100" : "10")
  )
    throw new Error("CONTRACT_FEE_LIMIT", {
      cause: { fee: tx.fee, timeBounds: tx.timeBounds, now: Date.now() / 1000 },
    });
}
/** What a signed single-call transaction invokes, without trusting the client. */
export function describeCall(encoded: string, chain: NetworkConfig) {
  const tx = TransactionBuilder.fromXDR(encoded, chain.passphrase);
  if (
    !(tx instanceof Transaction) ||
    tx.operations.length !== 1 ||
    tx.memo.type !== "none"
  )
    throw new Error("INVALID_TRANSACTION");
  const op = tx.operations[0];
  if (
    op.type !== "invokeHostFunction" ||
    op.source ||
    op.func.type !== "hostFunctionTypeInvokeContract"
  )
    throw new Error("INVALID_TRANSACTION");
  const call = op.func.invokeContract;
  return {
    source: tx.source,
    fee: BigInt(tx.fee),
    contract: Address.fromScAddress(call.contractAddress).toString(),
    method: call.functionName.toString(),
    args: call.args.map((a) => scValToNative(a) as unknown),
  };
}
/**
 * Pays the network fee of a user-signed transaction with a fee-bump from the
 * sponsor account. The sponsor signs only the outer envelope: it cannot change
 * the inner call or authorize anything in a vault.
 */
export async function submitFeeBump(
  chain: NetworkConfig,
  encoded: string,
  sponsor: Keypair,
) {
  const inner = TransactionBuilder.fromXDR(encoded, chain.passphrase);
  if (!(inner instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
  const bump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    (BigInt(inner.fee) + BigInt(100)).toString(),
    inner,
    chain.passphrase,
  );
  bump.sign(sponsor);
  const s = await server(chain);
  const sent = await s.sendTransaction(bump);
  if (sent.status === "ERROR") throw new Error("CONTRACT_REJECTED");
  for (let n = 0; n < 15; n++) {
    const result = await s.getTransaction(sent.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS)
      return { txHash: sent.hash };
    if (result.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error("CONTRACT_REJECTED");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("SUBMISSION_UNCERTAIN");
}
/** A classic changeTrust so a wallet can hold a token (e.g. before a faucet). */
export async function trustlineXdr(
  chain: NetworkConfig,
  address: string,
  code: string,
  issuer: string,
) {
  const s = await server(chain);
  return new TransactionBuilder(await s.getAccount(address), {
    fee: "100",
    networkPassphrase: chain.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) }))
    .setTimeout(300)
    .build()
    .toXDR();
}
export async function submitContract(chain: NetworkConfig, encoded: string) {
  const tx = TransactionBuilder.fromXDR(encoded, chain.passphrase);
  if (!(tx instanceof Transaction)) throw new Error("INVALID_TRANSACTION");
  const s = await server(chain);
  const sent = await s.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error("CONTRACT_REJECTED");
  for (let n = 0; n < 15; n++) {
    const result = await s.getTransaction(sent.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return result;
    if (result.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error("CONTRACT_REJECTED");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("SUBMISSION_UNCERTAIN");
}
export async function verifyCode(
  chain: NetworkConfig,
  address: string,
  kind: "vault" | "factory",
) {
  const s = await server(chain);
  const bytes = await s.getContractWasmByContractId(address);
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== artifacts[kind].sha256) throw new Error("UNVERIFIED_CONTRACT");
}
export async function verifiedConfig(
  chain: NetworkConfig,
  address: string,
  factory?: string,
) {
  await verifyCode(chain, address, "vault");
  const c = await readContract<ContractConfig>(chain, address, "config");
  await verifyCode(chain, c.factory, "factory");
  if (factory && c.factory !== factory) throw new Error("UNVERIFIED_CONTRACT");
  const valid = await readContract<boolean>(chain, c.factory, "is_vault", [
    val.address(address),
  ]);
  if (!valid) throw new Error("UNVERIFIED_CONTRACT");
  return c;
}
export function createArgs(
  creator: string,
  salt: Uint8Array,
  name: string,
  rules: Rules,
) {
  if (salt.length !== 32) throw new Error("INVALID_INPUT");
  return [
    val.address(creator),
    nativeToScVal(salt),
    val.string(name),
    rulesVal(rules),
  ];
}
