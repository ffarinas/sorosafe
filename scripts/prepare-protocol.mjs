// Operator tool: writes unsigned XDR and a review record. It never signs or submits.
import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import {
  Address,
  Asset,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { contractAssets, structVal, val } from "../qa/contracts.mjs";
const { values: v } = parseArgs({
  options: {
    network: { type: "string" },
    source: { type: "string" },
    step: { type: "string" },
    collector: { type: "string" },
    "fee-bps": { type: "string" },
    out: { type: "string" },
    asset: { type: "string" },
  },
});
if (
  !["mainnet", "testnet"].includes(v.network) ||
  !v.source ||
  !StrKey.isValidEd25519PublicKey(v.source) ||
  !v.out
)
  throw Error(
    "Required: --network mainnet|testnet --source G... --out qa/transaction --step upload-vault|upload-factory|asset|factory",
  );
const chain =
  v.network === "mainnet"
    ? {
        id: "mainnet",
        passphrase: "Public Global Stellar Network ; September 2015",
        rpc: "https://soroban-rpc.mainnet.stellar.gateway.fm",
      }
    : {
        id: "testnet",
        passphrase: "Test SDF Network ; September 2015",
        rpc: "https://soroban-testnet.stellar.org",
      };
const server = new rpc.Server(chain.rpc);
if ((await server.getNetwork()).passphrase !== chain.passphrase)
  throw Error("Network mismatch");
const artifacts = JSON.parse(
  await readFile("lib/contract-artifacts.json", "utf8"),
);
let operation, description;
if (["upload-vault", "upload-factory"].includes(v.step)) {
  const kind = v.step.slice(7),
    wasm = await readFile(`public/contracts/junto_${kind}.wasm`);
  if (
    createHash("sha256").update(wasm).digest("hex") !== artifacts[kind].sha256
  )
    throw Error("Artifact hash mismatch");
  operation = Operation.uploadContractWasm({ wasm });
  description = { kind, sha256: artifacts[kind].sha256 };
} else if (v.step === "asset") {
  const a = contractAssets(chain).find((a) => a.code === v.asset);
  if (!a) throw Error("Unknown official asset");
  operation = Operation.createStellarAssetContract({
    asset: a.issuer ? new Asset(a.code, a.issuer) : Asset.native(),
  });
  description = a;
} else if (v.step === "factory") {
  if (
    !v.collector ||
    !StrKey.isValidEd25519PublicKey(v.collector) ||
    !/^\d+$/.test(v["fee-bps"] || "") ||
    Number(v["fee-bps"]) > 1000
  )
    throw Error("Explicit --collector G... and --fee-bps 0..1000 required");
  const assets = contractAssets(chain);
  const protocol = structVal({
    assets: nativeToScVal(assets.map((a) => val.address(a.contract))),
    collector: val.address(v.collector),
    fee_bps: val.u32(Number(v["fee-bps"])),
  });
  const salt = randomBytes(32);
  operation = Operation.createCustomContract({
    address: Address.fromString(v.source),
    wasmHash: Buffer.from(artifacts.factory.sha256, "hex"),
    salt,
    constructorArgs: [
      nativeToScVal(Buffer.from(artifacts.vault.sha256, "hex")),
      protocol,
    ],
  });
  description = {
    collector: v.collector,
    feeBps: Number(v["fee-bps"]),
    assets,
    salt: salt.toString("hex"),
    immutable: true,
    artifacts,
  };
} else throw Error("Unknown deployment step");
const tx = new TransactionBuilder(await server.getAccount(v.source), {
  fee: "100",
  networkPassphrase: chain.passphrase,
})
  .addOperation(operation)
  .setTimeout(600)
  .build();
const sim = await server.simulateTransaction(tx);
if (!rpc.Api.isSimulationSuccess(sim)) throw Error(sim.error);
const built = rpc.assembleTransaction(tx, sim).build();
await mkdir(dirname(v.out), { recursive: true });
await writeFile(v.out + ".xdr", built.toXDR() + "\n");
await writeFile(
  v.out + ".json",
  JSON.stringify(
    {
      network: chain.id,
      source: v.source,
      step: v.step,
      maximumFeeStroops: built.fee,
      expires: built.timeBounds?.maxTime,
      transactionHash: Buffer.from(built.hash()).toString("hex"),
      description,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Unsigned transaction: ${v.out}.xdr\nReview: ${v.out}.json`);
