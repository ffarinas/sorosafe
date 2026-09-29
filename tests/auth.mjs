import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
const base = "http://localhost:8789",
  domain = new URL(base).host;
const client = Keypair.random(),
  attacker = Keypair.random();
assert.equal(
  (await (await fetch(base + "/api/junto")).json()).network.id,
  "testnet",
  "This suite only runs against Testnet.",
);
let checks = 0;
const infoResponse = await fetch(base + "/.well-known/stellar.toml");
assert.equal(infoResponse.status, 200);
checks++;
const info = await infoResponse.text();
const server = Keypair.fromPublicKey(
  info.match(/^SIGNING_KEY="([A-Z2-7]+)"$/m)[1],
);
assert.ok(info.includes(`WEB_AUTH_ENDPOINT="${base}/api/auth"`));
checks++;
async function challenge() {
  const r = await fetch(base + "/api/auth?account=" + client.publicKey());
  assert.equal(r.status, 200);
  checks++;
  return (await r.json()).transaction;
}
async function login(transaction, extra = {}, origin = base, form = false) {
  const body = { transaction, ...extra };
  const r = await fetch(base + "/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": form
        ? "application/x-www-form-urlencoded"
        : "application/json",
      Origin: origin,
    },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }
  return { status: r.status, data, cookie: r.headers.get("set-cookie") };
}
function sign(xdr, key = client, network = Networks.TESTNET) {
  const tx = TransactionBuilder.fromXDR(xdr, network);
  tx.sign(key);
  return tx.toXDR();
}
async function deny(xdr, origin = base) {
  const r = await login(xdr, {}, origin);
  assert.notEqual(r.status, 200);
  assert.equal(r.cookie, null);
  checks += 2;
}
const original = await challenge();
const parsed = WebAuth.readChallengeTx(
  original,
  server.publicKey(),
  Networks.TESTNET,
  domain,
  domain,
);
assert.equal(parsed.clientAccountID, client.publicKey());
assert.equal(parsed.tx.sequence, "0");
assert.equal(parsed.tx.signatures.length, 1);
assert.equal(parsed.tx.operations.length, 2);
assert.equal(parsed.tx.source, server.publicKey());
checks += 5;
await deny(original); // Missing user signature.
await deny(sign(original, attacker));
await deny(sign(original, client, Networks.PUBLIC));
await deny(sign(original), "https://unrelated.example");
const stripped = TransactionBuilder.fromXDR(original, Networks.TESTNET);
stripped.signatures.length = 0;
stripped.sign(client);
await deny(stripped.toXDR());
const [first, second] = await Promise.all([
  login(sign(original), { name: "Auth QA" }),
  login(sign(original), { name: "Auth QA" }),
]);
assert.deepEqual([first.status, second.status].sort(), [200, 400]);
checks++;
const accepted = first.status === 200 ? first : second;
assert.match(accepted.cookie, /HttpOnly; SameSite=Strict/);
checks++;
const [header, payload, signature] = accepted.data.token.split(".");
assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "EdDSA");
assert.ok(
  server.verify(
    Buffer.from(header + "." + payload),
    Buffer.from(signature, "base64url"),
  ),
);
const claims = JSON.parse(Buffer.from(payload, "base64url"));
assert.equal(claims.iss, base);
assert.equal(claims.sub, client.publicKey());
assert.equal(claims.exp - claims.iat, 86400);
checks += 5;
const state = await (
  await fetch(base + "/api/junto", {
    headers: { Authorization: "Bearer " + accepted.data.token },
  })
).json();
assert.equal(state.user.address, client.publicKey());
checks++;
const tampered = accepted.data.token.slice(0, -4) + "AAAA";
const invalid = await (
  await fetch(base + "/api/junto", {
    headers: { Authorization: "Bearer " + tampered },
  })
).json();
assert.equal(invalid.user, null);
checks++;
await deny(sign(original)); // Replay after success.
const form = await login(sign(await challenge()), {}, base, true);
assert.equal(form.status, 200);
checks++;
const noDomain = await fetch(
  base +
    "/api/auth?account=" +
    client.publicKey() +
    "&home_domain=unrelated.example",
);
assert.equal(noDomain.status, 400);
checks++;
const logout = await fetch(base + "/api/junto", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: base,
    Authorization: "Bearer " + accepted.data.token,
  },
  body: JSON.stringify({ action: "logout" }),
});
assert.equal(logout.status, 200);
checks++;
const revoked = await (
  await fetch(base + "/api/junto", {
    headers: { Authorization: "Bearer " + accepted.data.token },
  })
).json();
assert.equal(revoked.user, null);
checks++;
const victim = Keypair.random().publicKey();
for (let n = 0; n < 6; n++) {
  const filled = await fetch(base + "/api/auth?account=" + victim, {
    headers: { "cf-connecting-ip": "203.0.113.8" },
  });
  assert.equal(filled.status, 200);
  checks++;
}
const replaced = await fetch(base + "/api/auth?account=" + victim, {
  headers: { "cf-connecting-ip": "203.0.113.9" },
});
assert.equal(replaced.status, 200);
checks++;
let limited = 200;
for (let n = 0; n < 31; n++) {
  const burst = await fetch(
    base + "/api/auth?account=" + Keypair.random().publicKey(),
    { headers: { "cf-connecting-ip": "203.0.113.10" } },
  );
  limited = burst.status;
  if (limited === 429) break;
}
assert.equal(limited, 429);
checks++;
const evidence = {
  date: new Date().toISOString(),
  checks,
  standard: "SEP-10",
  scope: "Individual G-address wallets on Stellar Testnet",
  tests: [
    "server-signed challenge",
    "domain and network binding",
    "user proof required",
    "wrong signer rejected",
    "missing server proof rejected",
    "foreign origin rejected",
    "concurrent replay rejected",
    "EdDSA JWT signature and expiry",
    "Bearer session and tampering",
    "form-encoded exchange",
    "logout revocation",
    "outstanding challenges do not lock the account",
    "challenge rate limit follows the caller",
  ],
};
await writeFile(
  "docs/auth-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
