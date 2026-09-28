import {
  Keypair,
  TransactionBuilder,
  Networks,
  WebAuth,
} from "@stellar/stellar-sdk";
import { writeFile } from "node:fs/promises";
const base = "http://localhost:8789";
const invite = process.argv[2];
const partners = ["Pedro UI", "Lucía UI"].map((name) => ({
  name,
  key: Keypair.random(),
  cookie: "",
}));
const recipient = Keypair.random();
async function call(p, action, body = {}) {
  const r = await fetch(base + "/api/junto", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: p.cookie,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const c = r.headers.get("set-cookie");
  if (c) p.cookie = c.split(";")[0];
  const d = await r.json();
  if (!r.ok) throw Error(JSON.stringify(d));
  return d;
}
const info = await (await fetch(base + "/.well-known/stellar.toml")).text();
const signingKey = info.match(/^SIGNING_KEY="([A-Z2-7]+)"$/m)?.[1];
let id;
for (const p of partners) {
  const r = await fetch(base + "/api/auth?account=" + p.key.publicKey());
  const c = await r.json();
  if (!r.ok) throw Error(c.error);
  const { tx } = WebAuth.readChallengeTx(
    c.transaction,
    signingKey,
    Networks.TESTNET,
    new URL(base).host,
    new URL(base).host,
  );
  tx.sign(p.key);
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: tx.toXDR(), name: p.name }),
  });
  if (!login.ok) throw Error(JSON.stringify(await login.json()));
  p.cookie = login.headers.get("set-cookie").split(";")[0];
  id = (await call(p, "join", { invite })).id;
}
const funded = await fetch(
  "https://friendbot.stellar.org/?addr=" + recipient.publicKey(),
);
if (!funded.ok) throw Error("Funding failed");
const details = {
  vault: id,
  recipient: recipient.publicKey(),
  partners: partners.map((p) => ({ name: p.name, address: p.key.publicKey() })),
};
await writeFile("qa/ui-team.json", JSON.stringify(details, null, 2));
console.log(JSON.stringify(details, null, 2));
for (let i = 0; i < 180; i++) {
  const r = await fetch(base + "/api/junto?vault=" + id, {
    headers: { Cookie: partners[0].cookie },
  });
  const s = await r.json();
  const p = s.payments.find(
    (x) =>
      x.status === "pending" &&
      x.destination === recipient.publicKey() &&
      x.amount === "65" &&
      x.approvals.length === 1,
  );
  if (p) {
    const tx = TransactionBuilder.fromXDR(p.xdr, Networks.TESTNET);
    tx.sign(partners[0].key);
    await call(partners[0], "approve", {
      vault: id,
      payment: p.id,
      signed: tx.toXDR(),
    });
    console.log("UI payment signed by second teammate", p.hash);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("Companions finished waiting; no matching payment was submitted.");
