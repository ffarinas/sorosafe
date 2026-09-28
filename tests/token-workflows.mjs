import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import ts from "typescript";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Asset,
  Operation,
  Account,
} from "@stellar/stellar-sdk";
const base = "http://localhost:8789";
const initial = await (await fetch(base + "/api/junto")).json();
assert.equal(
  initial.network.id,
  "testnet",
  "This suite only submits transactions on Testnet.",
);
const chain = initial.network;
await mkdir("qa/client-checks", { recursive: true });
for (const sourceModule of ["assets", "client-wallet"]) {
  const source = (await readFile(`lib/${sourceModule}.ts`, "utf8")).replace(
    '"./assets"',
    '"./assets.mjs"',
  );
  await writeFile(
    `qa/client-checks/${sourceModule}.mjs`,
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const { assertActivation, assertPayment } =
  await import("../qa/client-checks/client-wallet.mjs");
let checks = 0;
const verify = (value) => {
  assert.ok(value);
  checks++;
};
const people = Array.from({ length: 3 }, (_, i) => ({
  key: Keypair.random(),
  name: `Token flow QA ${i + 1}`,
  cookie: "",
}));
function sign(encoded, key) {
  const tx = TransactionBuilder.fromXDR(encoded, Networks.TESTNET);
  tx.sign(key);
  return tx.toXDR();
}
async function call(p, action, body = {}) {
  const r = await fetch(base + "/api/junto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: p.cookie,
    },
    body: JSON.stringify({ action, ...body }),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(p, action, body = {}) {
  const r = await call(p, action, body);
  assert.equal(r.status, 200, JSON.stringify(r));
  checks++;
  return r.data;
}
async function deny(p, action, body, code) {
  const r = await call(p, action, body);
  assert.equal(r.data.error, code, JSON.stringify(r));
  checks++;
}
async function state(p, id) {
  const r = await fetch(base + "/api/junto?vault=" + id, {
    headers: { Cookie: p.cookie },
  });
  assert.equal(r.status, 200);
  return r.json();
}
for (const p of people) {
  const c = await (
    await fetch(base + "/api/auth?account=" + p.key.publicKey())
  ).json();
  const r = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      transaction: sign(c.transaction, p.key),
      name: p.name,
    }),
  });
  assert.equal(r.status, 200);
  p.cookie = r.headers.get("set-cookie").split(";")[0];
  checks++;
}
const [a, b, c] = people;
const { id } = await ok(a, "create", {
  name: "Atomic activation and tokens · QA",
});
await ok(a, "configure", { vault: id, size: 3, threshold: 2 });
const { invite } = await ok(a, "invite", { vault: id });
await ok(b, "join", { invite });
await ok(c, "join", { invite });
await deny(b, "prepareVault", { vault: id }, "NOT_OWNER");
await deny(a, "prepareVault", { vault: id }, "ACCOUNT_MISSING");
console.log("Funding a real Testnet owner wallet; preparing atomic activation");
const funded = await fetch(
  "https://friendbot.stellar.org/?addr=" + a.key.publicKey(),
);
assert.ok(funded.ok, await funded.text());
const quote = await ok(a, "prepareVault", { vault: id });
const before = await state(a, id);
await assertActivation(quote, before.vault, before.people, chain);
checks++;
assert.deepEqual(await ok(a, "prepareVault", { vault: id }), quote);
checks++;
await assert.rejects(() =>
  assertActivation(
    { ...quote, funding: "100" },
    before.vault,
    before.people,
    chain,
  ),
);
checks++;
await assert.rejects(() =>
  assertActivation(
    quote,
    { ...before.vault, threshold: 1 },
    before.people,
    chain,
  ),
);
checks++;
await assert.rejects(() =>
  assertActivation(quote, before.vault, before.people, {
    ...chain,
    passphrase: Networks.PUBLIC,
  }),
);
checks++;
await deny(
  a,
  "activate",
  { vault: id, signed: quote.xdr },
  "INVALID_SIGNATURE",
);
await deny(
  a,
  "activate",
  { vault: id, signed: sign(quote.xdr, b.key) },
  "INVALID_SIGNATURE",
);
await ok(a, "activate", { vault: id, signed: sign(quote.xdr, a.key) });
let current = await state(a, id);
verify(current.vault.status === "active");
const onchain = await (
  await fetch(chain.horizon + "/accounts/" + quote.address)
).json();
verify(onchain.signers.find((s) => s.key === quote.address).weight === 0);
verify(Object.values(onchain.thresholds).every((n) => n === 2));
verify(onchain.signers.filter((s) => s.weight > 0).length === 3);
const token = initial.catalog[0];
console.log(
  "Enabling real Circle Testnet USDC with two independent signatures",
);
await deny(
  a,
  "enableAsset",
  { vault: id, code: token.code, issuer: a.key.publicKey() },
  "ASSET_UNAVAILABLE",
);
const enabled = await ok(a, "enableAsset", {
  vault: id,
  code: token.code,
  issuer: token.issuer,
});
await deny(
  a,
  "enableAsset",
  { vault: id, code: token.code, issuer: token.issuer },
  "PAYMENT_PENDING",
);
current = await state(a, id);
const payment = current.payments.find((p) => p.id === enabled.id);
verify(
  payment.kind === "enable" &&
    payment.amount === "0" &&
    payment.code === "USDC",
);
await assertPayment(payment, quote.address, chain);
checks++;
await assert.rejects(() =>
  assertPayment(
    { ...payment, issuer: a.key.publicKey() },
    quote.address,
    chain,
  ),
);
checks++;
const tx = TransactionBuilder.fromXDR(payment.xdr, Networks.TESTNET);
const malicious = new TransactionBuilder(
  new Account(quote.address, String(BigInt(tx.sequence) - 1n)),
  {
    fee: tx.fee,
    networkPassphrase: Networks.TESTNET,
    timebounds: tx.timeBounds,
  },
)
  .addOperation(
    Operation.changeTrust({
      asset: new Asset(token.code, token.issuer),
      limit: "1",
    }),
  )
  .build();
await assert.rejects(() =>
  assertPayment(
    {
      ...payment,
      xdr: malicious.toXDR(),
      hash: Buffer.from(malicious.hash()).toString("hex"),
    },
    quote.address,
    chain,
  ),
);
checks++;
await ok(a, "approve", {
  vault: id,
  payment: payment.id,
  signed: sign(payment.xdr, a.key),
});
const oneSignature = await state(a, id);
verify(oneSignature.payments[0].status === "pending");
verify(!oneSignature.balances.some((x) => x.issuer === token.issuer));
await ok(b, "approve", {
  vault: id,
  payment: payment.id,
  signed: sign(payment.xdr, b.key),
});
current = await state(a, id);
verify(current.payments[0].status === "paid");
verify(
  current.balances.some(
    (x) =>
      x.code === token.code &&
      x.issuer === token.issuer &&
      x.balance === "0.0000000",
  ),
);
await deny(
  a,
  "enableAsset",
  { vault: id, code: token.code, issuer: token.issuer },
  "ASSET_ENABLED",
);
const evidence = {
  network: chain.label,
  checkedAt: new Date().toISOString(),
  checks,
  vault: id,
  address: quote.address,
  activation: Buffer.from(
    TransactionBuilder.fromXDR(quote.xdr, Networks.TESTNET).hash(),
  ).toString("hex"),
  enableAsset: payment.hash,
  tests: [
    "Atomic funded activation: master key disabled and 2-of-3 policy enforced",
    "Prepared activation resumed unchanged",
    "Forged funding, policy, network and missing wallet signatures rejected",
    "Real Circle USDC trustline requires two independent signatures",
    "Changed issuer and trustline limit rejected before signing",
    "Duplicate enablement rejected; real zero balance appears after confirmation",
  ],
};
await writeFile(
  "docs/token-workflows-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
