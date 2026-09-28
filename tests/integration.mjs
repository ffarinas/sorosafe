import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  Keypair,
  Account,
  TransactionBuilder,
  Operation,
  Networks,
  WebAuth,
  Asset,
} from "@stellar/stellar-sdk";
const base = "http://localhost:8789",
  horizon = "https://horizon-testnet.stellar.org";
const people = Array.from({ length: 4 }, (_, i) => ({
  key: Keypair.random(),
  name: ["Ana QA", "Pedro QA", "Lucía QA", "Other team QA"][i],
  cookie: "",
}));
const vaultKey = Keypair.random(),
  recipient = Keypair.random();
assert.equal(
  (await (await fetch(base + "/api/junto")).json()).network.id,
  "testnet",
  "This suite only runs against Testnet.",
);
let checks = 0;
async function request(p, action, body = {}) {
  const r = await fetch(base + "/api/junto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(p.cookie ? { Cookie: p.cookie } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const cookie = r.headers.get("set-cookie");
  if (cookie) p.cookie = cookie.split(";")[0];
  return { status: r.status, data: await r.json() };
}
async function ok(p, action, body) {
  const r = await request(p, action, body);
  assert.equal(r.status, 200, JSON.stringify(r));
  checks++;
  return r.data;
}
async function rejected(p, action, body, code) {
  const r = await request(p, action, body);
  assert.notEqual(r.status, 200);
  assert.equal(r.data.error, code, JSON.stringify(r));
  checks++;
}
function sign(xdr, key) {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  tx.sign(key);
  return tx.toXDR();
}
async function state(p, id) {
  const r = await fetch(base + "/api/junto?vault=" + id, {
    headers: { Cookie: p.cookie },
  });
  return { status: r.status, data: await r.json() };
}
async function fund(key) {
  const r = await fetch(
    "https://friendbot.stellar.org/?addr=" + key.publicKey(),
  );
  assert.ok(r.ok, await r.text());
}
console.log("Authenticating four independent test wallets with SEP-10");
const info = await (await fetch(base + "/.well-known/stellar.toml")).text();
const signingKey = info.match(/^SIGNING_KEY="([A-Z2-7]+)"$/m)?.[1];
assert.ok(signingKey);
for (const p of people) {
  const challenge = await (
    await fetch(base + "/api/auth?account=" + p.key.publicKey())
  ).json();
  const decoded = WebAuth.readChallengeTx(
    challenge.transaction,
    signingKey,
    Networks.TESTNET,
    new URL(base).host,
    new URL(base).host,
  );
  assert.equal(decoded.clientAccountID, p.key.publicKey());
  const transaction = sign(challenge.transaction, p.key);
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ transaction, name: p.name }),
  });
  assert.equal(login.status, 200, JSON.stringify(await login.json()));
  p.cookie = login.headers.get("set-cookie").split(";")[0];
  const replay = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ transaction }),
  });
  assert.equal((await replay.json()).error, "EXPIRED_LOGIN");
  checks += 3;
}
const [a, b, c, outsider] = people;
const created = await ok(a, "create", {
  name: "Meridian · Lisboa 2026 · QA",
});
const id = created.id;
const draft = (await state(a, id)).data.vault;
assert.equal(draft.size, 0);
assert.equal(draft.threshold, 0);
assert.equal(created.invite, undefined);
checks += 3;
await rejected(a, "invite", { vault: id }, "CONFIGURATION_REQUIRED");
await rejected(
  a,
  "prepareActivation",
  { vault: id, address: vaultKey.publicKey() },
  "CONFIGURATION_REQUIRED",
);
await rejected(
  a,
  "configure",
  { vault: id, size: 3, threshold: 4 },
  "INVALID_RULE",
);
await ok(a, "configure", { vault: id, size: 3, threshold: 2 });
const earlier = await ok(a, "invite", { vault: id });
await ok(a, "configure", { vault: id, size: 3, threshold: 3 });
await rejected(b, "join", { invite: earlier.invite }, "INVITE_CLOSED");
await ok(a, "configure", { vault: id, size: 3, threshold: 2 });
created.invite = (await ok(a, "invite", { vault: id })).invite;
await ok(b, "join", { invite: created.invite });
await rejected(
  b,
  "configure",
  { vault: id, size: 4, threshold: 3 },
  "NOT_OWNER",
);
await ok(c, "join", { invite: created.invite });
await rejected(
  a,
  "configure",
  { vault: id, size: 2, threshold: 2 },
  "CONFIGURATION_CHANGED",
);
await rejected(outsider, "join", { invite: created.invite }, "NOT_MEMBER");
const privateRead = await state(outsider, id);
assert.equal(privateRead.status, 403);
checks++;
await rejected(
  outsider,
  "contact",
  { vault: id, name: "Intruder", address: recipient.publicKey() },
  "NOT_MEMBER",
);
console.log("Funding new vault and recipient on Stellar Testnet");
await Promise.all([fund(vaultKey), fund(recipient)]);
const setup = await ok(a, "prepareActivation", {
  vault: id,
  address: vaultKey.publicKey(),
});
await rejected(
  b,
  "activate",
  { vault: id, signed: sign(setup.xdr, vaultKey) },
  "NOT_OWNER",
);
await ok(a, "activate", { vault: id, signed: sign(setup.xdr, vaultKey) });
await rejected(
  a,
  "configure",
  { vault: id, size: 3, threshold: 3 },
  "ALREADY_ACTIVE",
);
await rejected(outsider, "join", { invite: created.invite }, "INVITE_CLOSED");
let current = (await state(a, id)).data;
assert.equal(current.vault.status, "active");
assert.equal(current.people.length, 3);
checks += 2;
await ok(a, "contact", {
  vault: id,
  name: "Alojamiento Lisboa",
  address: recipient.publicKey(),
  memo: "Meridian",
});
current = (await state(b, id)).data;
assert.equal(current.contacts.length, 1);
assert.equal(current.contacts[0].creatorName, a.name);
assert.equal(current.contacts[0].paidCount, 0);
checks += 3;
await rejected(
  a,
  "contact",
  {
    vault: id,
    name: "Duplicate",
    address: recipient.publicKey(),
    memo: "Meridian",
  },
  "CONTACT_EXISTS",
);
await ok(b, "payment", {
  vault: id,
  contact: current.contacts[0].id,
  amount: "12.3456789",
  code: "XLM",
  issuer: "",
  note: "Reserva del equipo",
});
current = (await state(a, id)).data;
const p = current.payments[0];
assert.equal(p.status, "pending");
assert.equal(p.approvals.length, 0);
checks += 2;
await rejected(
  c,
  "approve",
  { vault: id, payment: p.id, signed: sign(p.xdr, outsider.key) },
  "INVALID_SIGNATURE",
);
const wrong = TransactionBuilder.fromXDR(p.xdr, Networks.TESTNET);
const changed = new TransactionBuilder(
  new Account(vaultKey.publicKey(), String(BigInt(wrong.sequence) - 1n)),
  { fee: "100", networkPassphrase: Networks.TESTNET },
)
  .addOperation(
    Operation.payment({
      destination: recipient.publicKey(),
      asset: (await import("@stellar/stellar-sdk")).Asset.native(),
      amount: "100",
    }),
  )
  .setTimeout(600)
  .build();
changed.sign(a.key);
await rejected(
  a,
  "approve",
  { vault: id, payment: p.id, signed: changed.toXDR() },
  "CHANGED_TRANSACTION",
);
console.log("Confirming network rejection below threshold");
const low = await fetch(horizon + "/transactions", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ tx: sign(p.xdr, a.key) }),
});
const lowBody = await low.json();
assert.equal(low.status, 400);
assert.equal(lowBody.extras.result_codes.transaction, "tx_bad_auth");
checks += 2;
await ok(a, "approve", {
  vault: id,
  payment: p.id,
  signed: sign(p.xdr, a.key),
});
await ok(a, "approve", {
  vault: id,
  payment: p.id,
  signed: sign(p.xdr, a.key),
});
current = (await state(a, id)).data;
assert.equal(current.payments[0].approvals.length, 1);
assert.equal(current.payments[0].status, "pending");
assert.equal(current.contacts[0].paidCount, 0);
checks += 3;
await rejected(
  b,
  "payment",
  {
    vault: id,
    contact: current.contacts[0].id,
    amount: "1",
    code: "XLM",
    issuer: "",
    note: "Another",
  },
  "PAYMENT_PENDING",
);
console.log("Adding second independent signature and confirming the receipt");
await ok(c, "approve", {
  vault: id,
  payment: p.id,
  signed: sign(p.xdr, c.key),
});
current = (await state(b, id)).data;
assert.equal(current.payments[0].status, "paid");
assert.equal(current.contacts[0].paidCount, 1);
checks += 2;
const receipt = await (await fetch(horizon + "/transactions/" + p.hash)).json();
assert.equal(receipt.successful, true);
checks++;
const recipientAccount = await (
  await fetch(horizon + "/accounts/" + recipient.publicKey())
).json();
assert.equal(
  recipientAccount.balances.find((b) => b.asset_type === "native").balance,
  "10012.3456789",
);
checks++;
await ok(c, "approve", {
  vault: id,
  payment: p.id,
  signed: sign(p.xdr, c.key),
});
const again = await (
  await fetch(horizon + "/accounts/" + recipient.publicKey())
).json();
assert.equal(
  again.balances.find((b) => b.asset_type === "native").balance,
  "10012.3456789",
);
checks++;
// Exercise real issued assets on Testnet, including two identical tickers with
// different issuers. No wallet state, balances or approvals are simulated.
console.log("Checking issued-asset identity and balances on Stellar Testnet");
const issuers = [Keypair.random(), Keypair.random()];
await Promise.all(issuers.map(fund));
const issued = issuers.map((key) => new Asset("QAUSD", key.publicKey()));
async function chainTransaction(source, operations, signers) {
  const account = await (await fetch(horizon + "/accounts/" + source)).json();
  let builder = new TransactionBuilder(new Account(source, account.sequence), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  });
  for (const operation of operations) builder = builder.addOperation(operation);
  const tx = builder.setTimeout(180).build();
  tx.sign(...signers);
  const response = await fetch(horizon + "/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: tx.toXDR() }),
  });
  const result = await response.json();
  assert.equal(result.successful, true, JSON.stringify(result));
  checks++;
  return result;
}
await chainTransaction(
  vaultKey.publicKey(),
  issued.map((asset) => Operation.changeTrust({ asset })),
  [a.key, c.key],
);
await chainTransaction(
  recipient.publicKey(),
  issued.map((asset) => Operation.changeTrust({ asset })),
  [recipient],
);
for (const [index, asset] of issued.entries()) {
  await chainTransaction(
    issuers[index].publicKey(),
    [
      Operation.payment({
        destination: vaultKey.publicKey(),
        asset,
        amount: "100",
      }),
    ],
    [issuers[index]],
  );
}
current = (await state(a, id)).data;
assert.equal(
  current.balances.filter((balance) => balance.code === "QAUSD").length,
  2,
);
assert.equal(
  current.balances.find((balance) => balance.issuer === issued[1].getIssuer())
    .available,
  "100.0000000",
);
assert.equal(current.chainError, undefined);
checks += 3;
const ledger = (
  await (await fetch(horizon + "/ledgers?order=desc&limit=1")).json()
)._embedded.records[0];
const actualAccount = await (
  await fetch(horizon + "/accounts/" + vaultKey.publicKey())
).json();
assert.equal(
  Number(current.balances.find((balance) => !balance.issuer).reserve),
  ((2 +
    actualAccount.subentry_count +
    actualAccount.num_sponsoring -
    actualAccount.num_sponsored) *
    ledger.base_reserve_in_stroops) /
    10000000,
);
checks++;
const body = {
  vault: id,
  contact: current.contacts[0].id,
  amount: "7.1234567",
  code: "QAUSD",
  issuer: issued[1].getIssuer(),
  note: "Real asset identity regression",
};
await rejected(a, "payment", { ...body, issuer: "" }, "INVALID_INPUT");
await rejected(
  a,
  "payment",
  { ...body, issuer: outsider.key.publicKey() },
  "ASSET_UNAVAILABLE",
);
await rejected(
  a,
  "payment",
  { ...body, amount: "100.0000001" },
  "INSUFFICIENT_FUNDS",
);
await rejected(
  a,
  "payment",
  {
    ...body,
    code: "XLM",
    issuer: "",
    amount: current.balances.find((balance) => !balance.issuer).balance,
  },
  "INSUFFICIENT_FUNDS",
);
await ok(b, "payment", body);
current = (await state(a, id)).data;
const tokenPayment = current.payments.find(
  (payment) => payment.status === "pending",
);
assert.equal(tokenPayment.code, body.code);
assert.equal(tokenPayment.issuer, body.issuer);
const tokenTx = TransactionBuilder.fromXDR(tokenPayment.xdr, Networks.TESTNET);
assert.equal(tokenTx.operations[0].asset.getIssuer(), body.issuer);
assert.equal(tokenTx.operations[0].asset.getCode(), body.code);
assert.equal(
  current.balances.find((balance) => balance.issuer === body.issuer).available,
  "92.8765433",
);
assert.equal(
  current.balances.find((balance) => balance.issuer === issued[0].getIssuer())
    .available,
  "100.0000000",
);
checks += 6;
const nativeBefore = current.balances.find(
  (balance) => !balance.issuer,
).balance;
await ok(a, "approve", {
  vault: id,
  payment: tokenPayment.id,
  signed: sign(tokenPayment.xdr, a.key),
});
await ok(c, "approve", {
  vault: id,
  payment: tokenPayment.id,
  signed: sign(tokenPayment.xdr, c.key),
});
current = (await state(a, id)).data;
assert.equal(
  current.payments.find((payment) => payment.id === tokenPayment.id).status,
  "paid",
);
assert.equal(
  current.balances.find((balance) => balance.issuer === body.issuer).balance,
  "92.8765433",
);
assert.equal(
  current.balances.find((balance) => balance.issuer === issued[0].getIssuer())
    .balance,
  "100.0000000",
);
const toUnits = (value) => BigInt(value.replace(".", ""));
assert.equal(
  toUnits(nativeBefore) -
    toUnits(current.balances.find((balance) => !balance.issuer).balance),
  BigInt(tokenTx.fee),
);
const received = await (
  await fetch(horizon + "/accounts/" + recipient.publicKey())
).json();
assert.equal(
  received.balances.find((balance) => balance.asset_issuer === body.issuer)
    .balance,
  "7.1234567",
);
checks += 5;
const evidence = {
  date: new Date().toISOString(),
  checks,
  vaultId: id,
  vaultAddress: vaultKey.publicKey(),
  paymentHash: p.hash,
  receipt: `https://stellar.expert/explorer/testnet/tx/${p.hash}`,
  network: "Stellar Testnet",
  tokenPaymentHash: tokenPayment.hash,
  tokenIssuer: body.issuer,
  tests: [
    "login proof and replay",
    "shared invitations and capacity",
    "membership isolation",
    "master key disabled",
    "shared contact creator",
    "immutable payment payload",
    "invalid signature rejected",
    "on-chain insufficient signatures rejected",
    "duplicate signatures idempotent",
    "pending payment serialization",
    "threshold payment confirmed",
    "contact history after confirmation",
    "double submission idempotent",
    "real issued-asset payment preserves code and issuer",
    "identical tickers with different issuers stay separate",
    "no XLM fallback for missing or invalid assets",
    "native balance changes only by fee for issued-asset payment",
    "live reserve and insufficient available-balance validation",
  ],
};
await writeFile(
  "docs/testnet-evidence.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
