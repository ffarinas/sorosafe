// Real Testnet transactions. Keys are ephemeral and never written to disk.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Address,
  Asset,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  prepareCall,
  readContract,
  submitContract,
  createArgs,
  val,
  actionVal,
  verifiedConfig,
  structVal,
} from "../qa/contracts.mjs";
const chain = {
  id: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  rpc: "https://soroban-testnet.stellar.org",
};
const s = new rpc.Server(chain.rpc);
assert.equal((await s.getNetwork()).passphrase, chain.passphrase);
const keys = Array.from({ length: 5 }, () => Keypair.random());
const checks = [];
const txs = [];
function ok(name, value) {
  assert(value, name);
  checks.push(name);
  console.log("PASS", name);
}
for (const key of keys) {
  const r = await fetch(
    "https://friendbot.stellar.org?addr=" + key.publicKey(),
    { signal: AbortSignal.timeout(60000) },
  );
  assert(r.ok, "Friendbot funding");
  console.log("Funded Testnet account", keys.indexOf(key) + 1);
}
async function op(key, operation) {
  const tx = new TransactionBuilder(await s.getAccount(key.publicKey()), {
    fee: "100",
    networkPassphrase: chain.passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim))
    throw new Error("Simulation: " + sim.error);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(key);
  const result = await submitContract(chain, prepared.toXDR());
  txs.push(result.txHash);
  return scValToNative(result.returnValue);
}
async function call(key, target, method, args) {
  const quote = await prepareCall(chain, key.publicKey(), target, method, args);
  const tx = TransactionBuilder.fromXDR(quote.xdr, chain.passphrase);
  tx.sign(key);
  const r = await submitContract(chain, tx.toXDR());
  txs.push(r.txHash);
  return scValToNative(r.returnValue);
}
const vaultWasm = await readFile(
  "contracts/target/wasm32v1-none/release/junto_vault.wasm",
);
const factoryWasm = await readFile(
  "contracts/target/wasm32v1-none/release/junto_factory.wasm",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest();
const vaultHash = await op(
  keys[0],
  Operation.uploadContractWasm({ wasm: vaultWasm }),
);
const factoryHash = await op(
  keys[0],
  Operation.uploadContractWasm({ wasm: factoryWasm }),
);
ok(
  "Uploaded vault hash matches compiled WASM",
  Buffer.from(vaultHash).equals(hash(vaultWasm)),
);
const xlm = Asset.native().contractId(chain.passphrase);
const protocol = structVal({
  assets: nativeToScVal([val.address(xlm)]),
  collector: val.address(keys[4].publicKey()),
  fee_bps: val.u32(25),
});
const factory = await op(
  keys[0],
  Operation.createCustomContract({
    address: Address.fromString(keys[0].publicKey()),
    wasmHash: factoryHash,
    salt: randomBytes(32),
    constructorArgs: [nativeToScVal(Buffer.from(vaultHash)), protocol],
  }),
);
console.log("Factory deployed", factory);
const rules = {
  signers: keys.slice(0, 3).map((k) => k.publicKey()),
  threshold: 2,
};
const salt = randomBytes(32);
const vault = await call(
  keys[0],
  factory,
  "create",
  createArgs(keys[0].publicKey(), salt, "Bóveda · prueba en red", rules),
);
const c = await verifiedConfig(chain, vault, factory);
ok(
  "Factory creates a registered vault with the exact quorum",
  c.rules.threshold === 2 && c.rules.signers.join() === rules.signers.join(),
);
await assert.rejects(() =>
  call(
    keys[1],
    factory,
    "create",
    createArgs(keys[0].publicKey(), salt, "Forged", rules),
  ),
);
ok("Another source cannot authorize the creator", true);
await assert.rejects(() =>
  call(
    keys[0],
    factory,
    "create",
    createArgs(keys[0].publicKey(), salt, "Duplicate", rules),
  ),
);
ok("Same creator and salt cannot create a second vault", true);
await call(keys[0], xlm, "transfer", [
  val.address(keys[0].publicKey()),
  val.address(vault),
  val.i128(100_000_000n),
]);
ok(
  "Vault holds a real SAC balance",
  (await readContract(chain, xlm, "balance", [val.address(vault)])) ===
    100_000_000n,
);
const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
const action = actionVal(["Pay", xlm, keys[3].publicKey(), 10_000_000n]);
await call(keys[0], vault, "propose", [
  val.address(keys[0].publicKey()),
  val.u64(0n),
  action,
  val.u64(expires),
]);
await assert.rejects(() =>
  call(keys[3], vault, "approve", [
    val.address(keys[3].publicKey()),
    val.u64(0n),
  ]),
);
ok("A nonmember cannot approve", true);
await assert.rejects(() =>
  call(keys[3], vault, "approve", [
    val.address(keys[1].publicKey()),
    val.u64(0n),
  ]),
);
ok("A forged signer is rejected by real host authorization", true);
ok(
  "The proposer counts as the first approval",
  (await readContract(chain, vault, "proposal", [val.u64(0n)])).approvals
    .length === 1,
);
await assert.rejects(() => call(keys[0], vault, "execute", [val.u64(0n)]));
ok("One approval cannot execute", true);
await assert.rejects(() =>
  call(keys[0], vault, "approve", [
    val.address(keys[0].publicKey()),
    val.u64(0n),
  ]),
);
ok("Duplicate approval cannot increase the quorum", true);
await call(keys[1], vault, "approve", [
  val.address(keys[1].publicKey()),
  val.u64(0n),
]);
const beforeTo = await readContract(chain, xlm, "balance", [
  val.address(keys[3].publicKey()),
]);
const beforeFee = await readContract(chain, xlm, "balance", [
  val.address(keys[4].publicKey()),
]);
await call(keys[2], vault, "execute", [val.u64(0n)]);
ok(
  "Exact recipient amount arrived",
  (await readContract(chain, xlm, "balance", [
    val.address(keys[3].publicKey()),
  ])) -
    beforeTo ===
    10_000_000n,
);
ok(
  "Fee arrived atomically in the same token",
  (await readContract(chain, xlm, "balance", [
    val.address(keys[4].publicKey()),
  ])) -
    beforeFee ===
    25_000n,
);
await assert.rejects(() => call(keys[0], vault, "execute", [val.u64(0n)]));
ok("Executed proposal cannot be replayed", true);
ok(
  "Recipient history persists on-chain",
  (await readContract(chain, vault, "payments_to", [
    val.address(keys[3].publicKey()),
  ])) === 1n,
);
// Force a direct SAC transfer authorization request from the vault. It has no
// external __check_auth / allowance / generic call escape hatch.
await assert.rejects(() =>
  call(keys[0], xlm, "transfer", [
    val.address(vault),
    val.address(keys[0].publicKey()),
    val.i128(1n),
  ]),
);
ok("Direct token withdrawal cannot bypass the vault", true);
// A signed transaction replay is rejected or reported as the original receipt;
// neither path creates another approval. Test altered-body signature at network.
const q = await prepareCall(chain, keys[2].publicKey(), vault, "propose", [
  val.address(keys[2].publicKey()),
  val.u64(1n),
  action,
  val.u64(expires),
]);
const unsigned = TransactionBuilder.fromXDR(q.xdr, chain.passphrase);
unsigned.sign(keys[3]);
const forged = await s.sendTransaction(unsigned);
ok(
  "Wrong Ed25519 transaction signer rejected by Stellar",
  forged.status === "ERROR",
);
const rotation = actionVal([
  "ChangeRules",
  {
    signers: [keys[1].publicKey(), keys[2].publicKey(), keys[3].publicKey()],
    threshold: 2,
  },
]);
await call(keys[0], vault, "propose", [
  val.address(keys[0].publicKey()),
  val.u64(1n),
  rotation,
  val.u64(expires),
]);
await call(keys[1], vault, "approve", [
  val.address(keys[1].publicKey()),
  val.u64(1n),
]);
await call(keys[2], vault, "execute", [val.u64(1n)]);
const rotated = await readContract(chain, vault, "config");
ok(
  "Original signer removed without changing the vault address",
  rotated.epoch === 1 && !rotated.rules.signers.includes(keys[0].publicKey()),
);
await assert.rejects(() =>
  call(keys[0], vault, "propose", [
    val.address(keys[0].publicKey()),
    val.u64(2n),
    action,
    val.u64(expires),
  ]),
);
ok("Removed signer loses authority", true);
const evidence = {
  network: chain.id,
  date: new Date().toISOString(),
  factory,
  vault,
  protocolFeeBpsTestFixture: 25,
  collector: keys[4].publicKey(),
  vaultHash: hash(vaultWasm).toString("hex"),
  factoryHash: hash(factoryWasm).toString("hex"),
  checks,
  transactions: txs,
};
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/soroban-testnet-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify({ factory, vault, checks: checks.length }));
