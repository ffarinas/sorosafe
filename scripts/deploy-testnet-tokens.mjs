// Testnet only. USDT0 does not exist on Stellar Testnet, so SoroSafe issues
// its own test USDT0 with a fixed supply held by a faucet contract, plus a
// faucet for Circle's Testnet USDC that anyone can top up. Every key used here
// is ephemeral (Friendbot) and is never written to disk; the issuer is locked
// after minting, so no more test USDT0 can ever be created.
// Usage: npm run contracts:build && npm run contracts:client &&
//        node scripts/deploy-testnet-tokens.mjs
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  Address,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { submitContract, val } from "../qa/contracts.mjs";

const chain = {
  id: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  rpc: "https://soroban-testnet.stellar.org",
};
const UNIT = 10_000_000n;
const SUPPLY = 100_000_000n * UNIT; // test USDT0 held by the faucet
const PER_CLAIM = { USDT0: 1_000n * UNIT, USDC: 10n * UNIT };
const usdc = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);
const s = new rpc.Server(chain.rpc);
if ((await s.getNetwork()).passphrase !== chain.passphrase)
  throw Error("Network mismatch");
const issuer = Keypair.random();
const funded = await fetch(
  "https://friendbot.stellar.org?addr=" + issuer.publicKey(),
  { signal: AbortSignal.timeout(60000) },
);
if (!funded.ok) throw Error("Friendbot funding failed");
const txs = [];
async function send(operation, soroban = true) {
  const tx = new TransactionBuilder(await s.getAccount(issuer.publicKey()), {
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
  ready.sign(issuer);
  const result = await submitContract(chain, ready.toXDR());
  txs.push(result.txHash);
  return result.returnValue ? scValToNative(result.returnValue) : undefined;
}
const usdt0 = new Asset("USDT0", issuer.publicKey());
const usdt0Contract = await send(
  Operation.createStellarAssetContract({ asset: usdt0 }),
);
const usdcContract = usdc.contractId(chain.passphrase);
const wasmHash = await send(
  Operation.uploadContractWasm({
    wasm: await readFile(
      "contracts/target/wasm32v1-none/release/junto_faucet.wasm",
    ),
  }),
);
const faucet = (token, amount) =>
  send(
    Operation.createCustomContract({
      address: Address.fromString(issuer.publicKey()),
      wasmHash,
      salt: randomBytes(32),
      constructorArgs: [val.address(token), val.i128(amount)],
    }),
  );
const usdt0Faucet = await faucet(usdt0Contract, PER_CLAIM.USDT0);
const usdcFaucet = await faucet(usdcContract, PER_CLAIM.USDC);
await send(
  Operation.invokeContractFunction({
    contract: usdt0Contract,
    function: "mint",
    args: [val.address(usdt0Faucet), val.i128(SUPPLY)],
  }),
);
// Fixed supply: with the issuer's key disabled nobody can mint more.
await send(Operation.setOptions({ masterWeight: 0 }), false);
const tokens = {
  network: chain.id,
  date: new Date().toISOString(),
  USDT0: {
    issuer: issuer.publicKey(),
    contract: usdt0Contract,
    faucet: usdt0Faucet,
    perClaim: (PER_CLAIM.USDT0 / UNIT).toString(),
    supply: (SUPPLY / UNIT).toString(),
    note: "SoroSafe test asset. USDT0 has no official Testnet deployment.",
  },
  USDC: {
    issuer: usdc.getIssuer(),
    contract: usdcContract,
    faucet: usdcFaucet,
    perClaim: (PER_CLAIM.USDC / UNIT).toString(),
    note: "Circle's Testnet USDC. Top up the faucet with a token transfer.",
  },
  transactions: txs,
};
await writeFile(
  "lib/testnet-tokens.json",
  JSON.stringify(tokens, null, 2) + "\n",
);
console.log(JSON.stringify(tokens, null, 2));
