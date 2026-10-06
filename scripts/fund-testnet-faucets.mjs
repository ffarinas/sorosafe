// Testnet only. Deploys the XLM faucet if it doesn't exist yet and tops up the
// XLM and Circle USDC faucets. XLM comes from Friendbot; USDC is bought with
// that XLM on the Testnet DEX. Every key is ephemeral and never written to disk.
// Usage: npm run contracts:build && npm run contracts:client &&
//        node scripts/fund-testnet-faucets.mjs
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
const XLM_PER_CLAIM = 100n; // each account can claim this once a day
const XLM_ACCOUNTS = 5; // Friendbot gives 10,000 XLM per new account
const USDC_TO_BUY = "1800"; // bounded by Testnet DEX liquidity at ~1 XLM
const s = new rpc.Server(chain.rpc);
if ((await s.getNetwork()).passphrase !== chain.passphrase)
  throw Error("Network mismatch");
const tokens = JSON.parse(await readFile("lib/testnet-tokens.json", "utf8"));
const xlm = Asset.native().contractId(chain.passphrase);
const usdc = new Asset("USDC", tokens.USDC.issuer);

async function account() {
  const key = Keypair.random();
  const r = await fetch(
    "https://friendbot.stellar.org?addr=" + key.publicKey(),
    { signal: AbortSignal.timeout(60000) },
  );
  if (!r.ok) throw Error("Friendbot funding failed");
  return key;
}
const txs = [];
async function send(key, operation, soroban = true) {
  const tx = new TransactionBuilder(await s.getAccount(key.publicKey()), {
    fee: "100000",
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
const transfer = (key, token, to, amount) =>
  send(
    key,
    Operation.invokeContractFunction({
      contract: token,
      function: "transfer",
      args: [val.address(key.publicKey()), val.address(to), val.i128(amount)],
    }),
  );

// XLM faucet: the same no-admin faucet contract as USDT0 and USDC.
const first = await account();
if (!tokens.XLM) {
  const wasmHash = await send(
    first,
    Operation.uploadContractWasm({
      wasm: await readFile(
        "contracts/target/wasm32v1-none/release/junto_faucet.wasm",
      ),
    }),
  );
  const faucet = await send(
    first,
    Operation.createCustomContract({
      address: Address.fromString(first.publicKey()),
      wasmHash,
      salt: randomBytes(32),
      constructorArgs: [val.address(xlm), val.i128(XLM_PER_CLAIM * UNIT)],
    }),
  );
  tokens.XLM = {
    issuer: "",
    contract: xlm,
    faucet,
    perClaim: XLM_PER_CLAIM.toString(),
    note: "Native Testnet XLM from Friendbot, handed out once a day per account.",
  };
}
// Keep ~50 XLM per account for reserves and fees.
const spare = 9_950n * UNIT;
await transfer(first, xlm, tokens.XLM.faucet, spare);
for (let i = 1; i < XLM_ACCOUNTS; i++)
  await transfer(await account(), xlm, tokens.XLM.faucet, spare);

// USDC: buy on the DEX, then hand the whole balance to the faucet.
const buyer = await account();
await send(buyer, Operation.changeTrust({ asset: usdc }), false);
await send(
  buyer,
  Operation.pathPaymentStrictReceive({
    sendAsset: Asset.native(),
    sendMax: "2500",
    destination: buyer.publicKey(),
    destAsset: usdc,
    destAmount: USDC_TO_BUY,
  }),
  false,
);
await transfer(
  buyer,
  tokens.USDC.contract,
  tokens.USDC.faucet,
  BigInt(USDC_TO_BUY) * UNIT,
);

tokens.date = new Date().toISOString();
tokens.transactions = [...(tokens.transactions ?? []), ...txs];
await writeFile(
  "lib/testnet-tokens.json",
  JSON.stringify(tokens, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { xlmFaucet: tokens.XLM.faucet, usdcFaucet: tokens.USDC.faucet, txs },
    null,
    2,
  ),
);
