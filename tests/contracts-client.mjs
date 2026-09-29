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
assert.throws(
  () => rulesVal({ signers: [signer, signer], threshold: 2 }),
  /INVALID_RULE/,
);
assert.throws(
  () => rulesVal({ signers: [signer, other], threshold: 1 }),
  /INVALID_RULE/,
);
const rule = { signers: [signer, other], threshold: 2 };
assert.deepEqual(scValToNative(rulesVal(rule)), rule);
assert.throws(
  () => createArgs(signer, new Uint8Array(31), "Vault", rule),
  /INVALID_INPUT/,
);
assert.notEqual(
  currencies.find((a) => a.code === "USDT0").contract,
  usdc.contract,
);
console.log(
  "10 contract-client checks passed: exact token, recipient, source, method, rules and constructor encoding.",
);
