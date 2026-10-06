import assert from "node:assert/strict";
import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  assertCall,
  createArgs,
  rulesVal,
  actionVal,
  val,
  contractAssets,
  sacId,
} from "../qa/contracts.mjs";
const chain = {
  id: "mainnet",
  passphrase: "Public Global Stellar Network ; September 2015",
};
const signer = Keypair.random().publicKey(),
  other = Keypair.random().publicKey();
const vault = "CBOSNOIJ6B6EP3MIVCASPPHS5CLDNPSU7C32I2PXEXND3QMUPKBK626H";
const currencies = contractAssets(chain),
  usdc = currencies.find((a) => a.code === "USDC"),
  xlm = currencies.find((a) => a.code === "XLM");
const expires = val.u64(BigInt(Math.floor(Date.now() / 1000) + 3600));
const args = [
  val.address(signer),
  val.u64(0n),
  actionVal(["Pay", usdc.contract, other, 1_000_000n]),
  expires,
];
const tx = new TransactionBuilder(new Account(signer, "0"), {
  fee: "100",
  networkPassphrase: chain.passphrase,
})
  .addOperation(new Contract(vault).call("propose", ...args))
  .setTimeout(300)
  .build();
assertCall(tx.toXDR(), chain, signer, vault, "propose", args);
assert.throws(
  () => assertCall(tx.toXDR(), chain, other, vault, "propose", args),
  /CHANGED_TRANSACTION/,
);
assert.throws(
  () => assertCall(tx.toXDR(), chain, signer, vault, "execute", args),
  /CHANGED_TRANSACTION/,
);
assert.throws(
  () =>
    assertCall(tx.toXDR(), chain, signer, vault, "propose", [
      ...args.slice(0, 2),
      actionVal(["Pay", xlm.contract, other, 1_000_000n]),
      expires,
    ]),
  /CHANGED_TRANSACTION/,
);
assert.throws(
  () =>
    assertCall(tx.toXDR(), chain, signer, vault, "propose", [
      ...args.slice(0, 2),
      actionVal(["Pay", usdc.contract, signer, 1_000_000n]),
      expires,
    ]),
  /CHANGED_TRANSACTION/,
);
// Rules: 1 to 20 distinct signers, threshold from 1 up to the team size.
for (const accepted of [
  { signers: [signer], threshold: 1 },
  { signers: [signer, other], threshold: 1 },
  { signers: [signer, other], threshold: 2 },
  {
    signers: Array.from({ length: 20 }, () => Keypair.random().publicKey()),
    threshold: 20,
  },
])
  assert.deepEqual(scValToNative(rulesVal(accepted)), accepted);
for (const rejected of [
  { signers: [signer, other], threshold: 0 },
  { signers: [signer, other], threshold: 3 },
  { signers: [signer], threshold: 1.5 },
  { signers: [], threshold: 1 },
  {
    signers: Array.from({ length: 21 }, () => Keypair.random().publicKey()),
    threshold: 1,
  },
  { signers: [signer, signer], threshold: 1 },
  { signers: [signer, vault], threshold: 1 },
])
  assert.throws(() => rulesVal(rejected), /INVALID_RULE/);
const rule = { signers: [signer, other], threshold: 2 };
assert.throws(
  () => createArgs(signer, new Uint8Array(31), "Vault", rule),
  /INVALID_INPUT/,
);
assert.notEqual(
  currencies.find((a) => a.code === "USDT0").contract,
  usdc.contract,
);
// Assets are identified by contract and issuer, never by ticker: a token with
// the same code from another issuer is a different contract.
const imposter = sacId(chain, "USDC", Keypair.random().publicKey());
assert.notEqual(imposter, usdc.contract);
assert.equal(sacId(chain, "USDC", usdc.issuer), usdc.contract);
assert(!currencies.some((a) => a.contract === imposter));
console.log(
  "contract-client checks passed: exact token, recipient, source, method, rules (1..20 signers, threshold 1..N), constructor encoding and asset identity.",
);
