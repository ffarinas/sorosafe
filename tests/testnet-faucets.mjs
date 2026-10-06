import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

// The real catalog module: faucets must exist on Testnet and never elsewhere.
const result = await build({
  entryPoints: [new URL("../lib/assets.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { testnetFaucet, testnetFaucetContracts } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
const tokens = (
  await import("../lib/testnet-tokens.json", { with: { type: "json" } })
).default;
const xlm = { code: "XLM", issuer: "" };
const usdc = { code: "USDC", issuer: tokens.USDC.issuer };
const usdt0 = { code: "USDT0", issuer: tokens.USDT0.issuer };

test("Testnet offers XLM, USDC and USDT0 faucets", () => {
  assert.equal(testnetFaucet("testnet", xlm)?.faucet, tokens.XLM.faucet);
  assert.equal(testnetFaucet("testnet", usdc)?.faucet, tokens.USDC.faucet);
  assert.equal(testnetFaucet("testnet", usdt0)?.faucet, tokens.USDT0.faucet);
  assert.deepEqual(
    [...testnetFaucetContracts("testnet")].sort(),
    [tokens.XLM.faucet, tokens.USDC.faucet, tokens.USDT0.faucet].sort(),
  );
});
test("a look-alike issuer gets no faucet", () => {
  assert.equal(
    testnetFaucet("testnet", { code: "USDC", issuer: "GXYZ" }),
    undefined,
  );
  assert.equal(
    testnetFaucet("testnet", { code: "XLM", issuer: tokens.USDC.issuer }),
    undefined,
  );
});
test("Mainnet has no faucet at all", () => {
  for (const asset of [xlm, usdc, usdt0, undefined])
    assert.equal(testnetFaucet("mainnet", asset), undefined);
  assert.deepEqual(testnetFaucetContracts("mainnet"), []);
});
