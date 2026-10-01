// Deploys a demo factory on Testnet only. Deployer and fee collector are
// ephemeral Friendbot accounts; their secrets are never written to disk.
// Usage: npm run contracts:client && node scripts/deploy-testnet-demo.mjs
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import {
  Address,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { submitContract, structVal, val } from "../qa/contracts.mjs";

const chain = {
  id: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  rpc: "https://soroban-testnet.stellar.org",
};
// Circle's Testnet USDC, the same issuer as lib/assets.ts uses for Testnet.
const usdc = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);
const FEE_BPS = 25;
const s = new rpc.Server(chain.rpc);
if ((await s.getNetwork()).passphrase !== chain.passphrase)
  throw Error("Network mismatch");
const deployer = Keypair.random(),
  collector = Keypair.random();
const txs = [];
for (const key of [deployer, collector]) {
  const r = await fetch(
    "https://friendbot.stellar.org?addr=" + key.publicKey(),
    { signal: AbortSignal.timeout(60000) },
  );
  if (!r.ok) throw Error("Friendbot funding failed");
}
async function send(key, operation, soroban = true) {
  const tx = new TransactionBuilder(await s.getAccount(key.publicKey()), {
    fee: "100",
    networkPassphrase: chain.passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();
  let ready = tx;
  if (soroban) {
    const sim = await s.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim))
      throw Error("Simulation: " + sim.error);
    ready = rpc.assembleTransaction(tx, sim).build();
  }
  ready.sign(key);
  const result = await submitContract(chain, ready.toXDR());
  txs.push(result.txHash);
  return result.returnValue ? scValToNative(result.returnValue) : undefined;
}
// The contract refuses a fee collector that cannot hold every listed asset.
await send(collector, Operation.changeTrust({ asset: usdc }), false);
for (const asset of [Asset.native(), usdc]) {
  try {
    await send(deployer, Operation.createStellarAssetContract({ asset }));
  } catch {
    /* Already deployed: SAC addresses are deterministic. */
  }
}
const read = (name) =>
  readFile(`contracts/target/wasm32v1-none/release/junto_${name}.wasm`);
const vaultWasm = await read("vault"),
  factoryWasm = await read("factory");
const artifacts = JSON.parse(
  await readFile("lib/contract-artifacts.json", "utf8"),
);
for (const [name, wasm] of [
  ["vault", vaultWasm],
  ["factory", factoryWasm],
])
  if (
    createHash("sha256").update(wasm).digest("hex") !== artifacts[name].sha256
  )
    throw Error(`${name} WASM does not match lib/contract-artifacts.json`);
const vaultHash = await send(
  deployer,
  Operation.uploadContractWasm({ wasm: vaultWasm }),
);
const factoryHash = await send(
  deployer,
  Operation.uploadContractWasm({ wasm: factoryWasm }),
);
const factory = await send(
  deployer,
  Operation.createCustomContract({
    address: Address.fromString(deployer.publicKey()),
    wasmHash: factoryHash,
    salt: randomBytes(32),
    constructorArgs: [
      nativeToScVal(Buffer.from(vaultHash)),
      structVal({
        assets: nativeToScVal([
          val.address(Asset.native().contractId(chain.passphrase)),
          val.address(usdc.contractId(chain.passphrase)),
        ]),
        collector: val.address(collector.publicKey()),
        fee_bps: val.u32(FEE_BPS),
      }),
    ],
  }),
);
const record = {
  date: new Date().toISOString(),
  network: chain.id,
  factory,
  vaultSha256: artifacts.vault.sha256,
  factorySha256: artifacts.factory.sha256,
  collector: collector.publicKey(),
  feeBps: FEE_BPS,
  assets: ["XLM", "USDC"],
  transactions: txs,
};
await writeFile(
  "docs/testnet-demo-factory.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify(record, null, 2));
console.log(`\nIn .dev.vars:\nJUNTO_NETWORK=testnet\nJUNTO_FACTORY=${factory}`);
