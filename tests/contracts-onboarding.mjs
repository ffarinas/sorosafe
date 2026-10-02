import assert from "node:assert/strict";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
await build({
  entryPoints: ["lib/client-wallet.ts"],
  outfile: "qa/client-wallet.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  target: "node22",
});
const { assertActivation } = await import("../qa/client-wallet.mjs");
const base = process.env.JUNTO_TEST_BASE || "http://localhost:8789";
const state = await fetch(base + "/api/junto").then((r) => r.json());
assert.equal(state.network.id, "testnet");
assert(state.factory);
const users = [];
let checks = 0;
async function call(u, action, body = {}) {
  const r = await fetch(base + "/api/junto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Authorization: "Bearer " + u.token,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const d = await r.json();
  assert(r.ok, JSON.stringify(d));
  return d;
}
for (let i = 0; i < 3; i++) {
  const key = Keypair.random(),
    name = `Contrato QA ${i + 1}`;
  const { transaction } = await fetch(
    base + "/api/auth?account=" + key.publicKey(),
  ).then((r) => r.json());
  const tx = TransactionBuilder.fromXDR(transaction, state.network.passphrase);
  tx.sign(key);
  const auth = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ transaction: tx.toXDR(), name }),
  });
  assert(auth.ok);
  const logged = await auth.json();
  users.push({ key, name, token: logged.token });
}
const owner = users[0];
assert(
  (
    await fetch("https://friendbot.stellar.org?addr=" + owner.key.publicKey(), {
      signal: AbortSignal.timeout(60000),
    })
  ).ok,
);
const { id } = await call(owner, "create", { name: "Integración contractual" });
await call(owner, "configure", { vault: id, size: 3, threshold: 2 });
const invite = await call(owner, "invite", { vault: id });
for (const u of users.slice(1))
  assert.equal((await call(u, "join", { invite: invite.invite })).id, id);
checks += 5;
const get = () =>
  fetch(base + "/api/junto?vault=" + id, {
    headers: { Authorization: "Bearer " + owner.token },
  }).then((r) => r.json());
const draft = await get();
assert.equal(draft.vault.custody, "soroban");
assert.equal(draft.people.length, 3);
checks += 2;
const quote = await call(owner, "prepareVault", { vault: id });
assert.equal(quote.kind, "soroban");
assert(quote.address.startsWith("C"));
checks += 2;
await assertActivation(
  quote,
  draft.vault,
  draft.people,
  state.network,
  state.factory,
);
checks++;
await assert.rejects(() =>
  assertActivation(
    { ...quote, feeBps: quote.feeBps + 1 },
    draft.vault,
    draft.people,
    state.network,
    state.factory,
  ),
);
checks++;
const tx = TransactionBuilder.fromXDR(quote.xdr, state.network.passphrase);
tx.sign(owner.key);
await call(owner, "activate", { vault: id, signed: tx.toXDR() });
const active = await get();
assert.equal(active.vault.status, "active");
assert.equal(active.vault.address, quote.address);
checks += 2;
await call(users[1], "contact", {
  vault: id,
  name: "Destinatario de prueba",
  address: users[2].key.publicKey(),
});
const shared = await get();
assert.equal(shared.contacts[0].creatorName, users[1].name);
assert.equal(shared.contacts[0].address, users[2].key.publicKey());
checks += 2;
const memo = await fetch(base + "/api/junto", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: base,
    Authorization: "Bearer " + owner.token,
  },
  body: JSON.stringify({
    action: "contact",
    vault: id,
    name: "Exchange with memo",
    address: users[2].key.publicKey(),
    memo: "123",
  }),
});
assert.equal((await memo.json()).error, "CONTRACT_MEMO_UNSUPPORTED");
checks++;
// Solo start: the creator alone gets a working 1-of-1 vault in one signature,
// exactly as the app does right after "Create vault".
const solo = users[1];
assert(
  (
    await fetch("https://friendbot.stellar.org?addr=" + solo.key.publicKey(), {
      signal: AbortSignal.timeout(60000),
    })
  ).ok,
);
const soloName = "Bóveda individual";
const soloVault = await call(solo, "create", { name: soloName });
const soloQuote = await call(solo, "prepareVault", { vault: soloVault.id });
await assertActivation(
  soloQuote,
  {
    custody: "soroban",
    owner: solo.key.publicKey(),
    name: soloName,
    threshold: 1,
  },
  [{ address: solo.key.publicKey() }],
  state.network,
  state.factory,
);
const soloTx = TransactionBuilder.fromXDR(
  soloQuote.xdr,
  state.network.passphrase,
);
soloTx.sign(solo.key);
await call(solo, "activate", { vault: soloVault.id, signed: soloTx.toXDR() });
const soloState = await fetch(base + "/api/junto?vault=" + soloVault.id, {
  headers: { Authorization: "Bearer " + solo.token },
}).then((r) => r.json());
assert.equal(soloState.vault.status, "active");
assert.equal(soloState.vault.size, 1);
assert.equal(soloState.vault.threshold, 1);
checks += 3;
await writeFile(
  "docs/contracts-onboarding-evidence.json",
  JSON.stringify(
    {
      network: "testnet",
      date: new Date().toISOString(),
      vault: quote.address,
      id,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ checks, vault: quote.address, id }));
