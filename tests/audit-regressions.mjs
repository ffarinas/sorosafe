// Real route/auth code, migrations, SQLite and SEP-10 signatures. Only external
// Stellar RPC responses and the D1 binding adapter are isolated test fixtures.
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import {
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const root = new URL("../", import.meta.url).pathname;
const output = new URL(`../qa/audit-tests-${process.pid}/`, import.meta.url);
await mkdir(output, { recursive: true });
const keys = Array.from({ length: 4 }, () => Keypair.random());
const addresses = keys.map((key) => key.publicKey());
const contract = StrKey.encodeContract(Buffer.alloc(32, 1));
const factory = StrKey.encodeContract(Buffer.alloc(32, 2));
const env = {
  JUNTO_NETWORK: "testnet",
  JUNTO_FACTORY: factory,
  STELLAR_AUTH_ORIGIN: "http://localhost",
  STELLAR_AUTH_SIGNING_SEED: Keypair.random().secret(),
};
let database, config, beforeBatch, beforePrepare, batchError;
let sponsorCall,
  sponsorXlm = 100;
function statement(sql) {
  return {
    bind(...args) {
      return {
        async first() {
          return database.prepare(sql).get(...args) ?? null;
        },
        async all() {
          return { results: database.prepare(sql).all(...args) };
        },
        execute() {
          return { meta: database.prepare(sql).run(...args) };
        },
        async run() {
          return this.execute();
        },
      };
    },
  };
}
env.DB = {
  prepare: statement,
  async batch(statements) {
    if (batchError) throw Error("STORAGE_UNAVAILABLE");
    const hook = beforeBatch;
    beforeBatch = undefined;
    hook?.();
    database.exec("BEGIN");
    try {
      // No yield inside the transaction, matching D1 batch serialization.
      const result = statements.map((s) => s.execute());
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};
globalThis.__juntoAuditTests = {
  env,
  config() {
    if (config instanceof Error) throw config;
    return structuredClone(config);
  },
  bumps: 0,
  call() {
    if (sponsorCall instanceof Error) throw sponsorCall;
    return sponsorCall;
  },
  prepare() {
    beforePrepare?.();
    return { result: contract, xdr: "prepared", fee: "0.01" };
  },
};
const originalFetch = globalThis.fetch;
const sponsorKey = Keypair.random();
globalThis.fetch = async (url) => {
  if (String(url).endsWith(`/accounts/${sponsorKey.publicKey()}`))
    return new Response(
      JSON.stringify({
        balances: [{ asset_type: "native", balance: String(sponsorXlm) }],
      }),
    );
  assert.match(
    String(url),
    /^https:\/\/horizon-testnet\.stellar\.org\/accounts\/G[A-Z2-7]+$/,
  );
  return new Response("{}", { status: 404 }); // Newly generated, unfunded signing key.
};
const journal = JSON.parse(
  await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url)),
);
const migrations = await Promise.all(
  journal.entries.map(({ tag }) =>
    readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8"),
  ),
);
await build({
  absWorkingDir: root,
  entryPoints: ["app/api/junto/route.ts", "lib/auth.ts"],
  outdir: output.pathname,
  outbase: root,
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  plugins: [
    {
      name: "test-boundaries",
      setup(b) {
        b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "env",
          namespace: "fixture",
        }));
        b.onResolve({ filter: /^@\/lib\/contracts$/ }, () => ({
          path: "rpc",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "env"
              ? "export const env = globalThis.__juntoAuditTests.env;"
              : `export const verifiedConfig = async () => globalThis.__juntoAuditTests.config();
         export const createArgs = (...args) => args;
         export const prepareCall = async () => globalThis.__juntoAuditTests.prepare();
         export const readContract = async () => ({ protocol: globalThis.__juntoAuditTests.config().protocol });
         export const verifyCode = async () => {};
         export const submitContract = async () => { throw Error('Unexpected submission'); };
         export const contractAssets = () => [];
         export const describeCall = () => globalThis.__juntoAuditTests.call();
         export const submitFeeBump = async () => { globalThis.__juntoAuditTests.bumps++; return { txHash: 'bumped' }; };`,
        }));
      },
    },
  ],
});
const { GET, POST } = await import(new URL("app/api/junto/route.mjs", output));
const { challenge, authenticate } = await import(
  new URL("lib/auth.mjs", output)
);
function reset(status = "activating") {
  database?.close();
  database = new DatabaseSync(":memory:");
  migrations.forEach((sql) => database.exec(sql));
  batchError = false;
  beforeBatch = undefined;
  beforePrepare = undefined;
  addresses.forEach((address, i) => {
    database
      .prepare("INSERT INTO people VALUES(?,?,?)")
      .run(address, `Person ${i}`, i);
    database
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(
        createHash("sha256")
          .update(`${Networks.TESTNET}:token${i}`)
          .digest("hex"),
        address,
        9999999999,
      );
  });
  database
    .prepare(
      "INSERT INTO vaults(id,name,owner,threshold,size,status,address,setup,invite_hash,created,network,custody) VALUES('vault','Vault',?,2,3,?,?,?,'old-invite',0,'testnet','soroban')",
    )
    .run(
      addresses[0],
      status,
      contract,
      status === "draft" ? null : "prepared",
    );
  addresses
    .slice(0, 3)
    .forEach((address) =>
      database.prepare("INSERT INTO members VALUES('vault',?)").run(address),
    );
  config = {
    factory,
    name: "Vault",
    epoch: 0,
    next_id: 0n,
    rules: { signers: addresses.slice(0, 3), threshold: 2 },
    protocol: { fee_bps: 0, collector: addresses[0], assets: [] },
  };
}
beforeEach(() => reset());
after(async () => {
  database.close();
  globalThis.fetch = originalFetch;
  delete globalThis.__juntoAuditTests;
  await rm(output, { recursive: true, force: true });
});
async function request(action, body = {}, signer = 0) {
  const response = await (action ? POST : GET)(
    new Request("http://localhost/api/junto?vault=vault", {
      method: action ? "POST" : "GET",
      headers: {
        Origin: "http://localhost",
        Authorization: `Bearer token${signer}`,
        "Content-Type": "application/json",
      },
      ...(action
        ? { body: JSON.stringify({ vault: "vault", action, ...body }) }
        : {}),
    }),
  );
  return { status: response.status, data: await response.json() };
}
const stored = () =>
  database.prepare("SELECT * FROM vaults WHERE id='vault'").get();
const members = () =>
  database
    .prepare("SELECT address FROM members WHERE vault='vault'")
    .all()
    .map((p) => p.address)
    .sort();
// A vault that cannot be opened answers 200 with the error, the vault list
// and nothing private: no vault, team, contacts or payments.
function assertClosed(response, code) {
  assert.equal(response.status, 200);
  assert.equal(response.data.vaultError, code);
  assert.equal(response.data.vault, undefined);
  assert.deepEqual(response.data.people, []);
  assert.deepEqual(response.data.contacts, []);
}
const contact = () =>
  request("contact", { name: "Supplier", address: addresses[3] });

test("activation requires exactly the agreed team regardless of ordering", async () => {
  config.rules.signers.reverse();
  assert.equal((await request()).data.vault.status, "active");
  assert.equal(stored().status, "active");
});
for (const [name, mutate] of [
  [
    "substituted signer",
    () => {
      config.rules.signers[1] = addresses[3];
    },
  ],
  [
    "different threshold",
    () => {
      config.rules.threshold = 3;
    },
  ],
  [
    "missing signer",
    () => {
      config.rules.signers.pop();
    },
  ],
])
  test(`activation rejects ${name} and reports the mismatch`, async () => {
    mutate();
    const response = await request();
    // The load still succeeds so the team keeps its vault list.
    assert.equal(response.status, 200);
    assert.equal(response.data.policyMismatch, true);
    assert.equal(response.data.vault.status, "activating");
    assert.equal(response.data.vaults.length, 1);
    assert.equal(stored().status, "activating");
    assert.equal(stored().setup, "prepared");
  });
test("owner discards a mismatched activation and gets a new salt", async () => {
  const first = (await request("prepareVault")).data.salt;
  config.rules.signers[1] = addresses[3];
  assert.equal(
    (await request("discardActivation", {}, 1)).data.error,
    "NOT_OWNER",
  );
  assert.equal((await request("discardActivation")).status, 200);
  assert.equal(stored().status, "draft");
  assert.equal(stored().address, null);
  assert.equal(stored().attempt, 1);
  const second = (await request("prepareVault")).data.salt;
  assert.notEqual(second, first);
  // Retrying the new attempt keeps its salt stable.
  assert.equal((await request("prepareVault")).data.salt, second);
});
test("an activation matching the team cannot be discarded", async () => {
  const response = await request("discardActivation");
  assert.equal(response.data.error, "ALREADY_ACTIVE");
  assert.equal(stored().status, "activating");
});
test("an unconfirmed deployment cannot be discarded", async () => {
  config = Error("CONTRACT_UNAVAILABLE");
  assert.equal(
    (await request("discardActivation")).data.error,
    "CONTRACT_UNAVAILABLE",
  );
  assert.equal(stored().status, "activating");
});
test("pending activation remains pending when RPC is unavailable", async () => {
  config = Error("CONTRACT_UNAVAILABLE");
  assert.equal((await request()).data.vault.status, "activating");
  assert.equal(stored().status, "activating");
});
for (const code of ["CONTRACT_UNAVAILABLE", "UNVERIFIED_CONTRACT"]) {
  test(`${code} never grants cached membership read or write access`, async () => {
    reset("active");
    config = Error(code);
    assertClosed(await request(), code);
    assert.equal((await contact()).data.error, code);
    assert.equal(
      database.prepare("SELECT count(*) as n FROM contacts").get().n,
      0,
    );
  });
}
test("failed reconciliation never restores access to a removed signer", async () => {
  reset("active");
  config.rules.signers[0] = addresses[3];
  batchError = true;
  assert.equal((await contact()).data.error, "STORAGE_UNAVAILABLE");
  assertClosed(await request(), "STORAGE_UNAVAILABLE");
  assert.equal(
    database.prepare("SELECT count(*) as n FROM contacts").get().n,
    0,
  );
});
test("self-removal syncs the team but denies the former member", async () => {
  reset("active");
  config.rules.signers[0] = addresses[3];
  config.epoch++;
  assertClosed(await request(), "NOT_MEMBER");
  assert.deepEqual(members(), config.rules.signers.toSorted());
  const joined = await request(undefined, {}, 3);
  assert.equal(joined.status, 200);
  assert.equal(joined.data.vaults[0].id, "vault");
});
test("new signers without an existing profile are indexed, existing names survive", async () => {
  reset("active");
  const newSigner = Keypair.random().publicKey();
  config.rules.signers[1] = newSigner;
  config.epoch++;
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(members(), config.rules.signers.toSorted());
  assert.equal(
    database
      .prepare("SELECT name FROM people WHERE address=?")
      .get(addresses[0]).name,
    "Person 0",
  );
  assert(
    database.prepare("SELECT 1 FROM people WHERE address=?").get(newSigner),
  );
});
test("draft owner can remove a member and revoke their invitation", async () => {
  reset("draft");
  assert.equal(
    (await request("removeMember", { address: addresses[1] }, 1)).data.error,
    "NOT_OWNER",
  );
  assert.equal(
    (await request("removeMember", { address: addresses[0] })).data.error,
    "CANNOT_REMOVE",
  );
  assert.equal(
    (await request("removeMember", { address: addresses[1] })).status,
    200,
  );
  assert.deepEqual(members(), [addresses[0], addresses[2]].sort());
  assert.equal(stored().invite_hash, null);
  assertClosed(await request(undefined, {}, 1), "NOT_MEMBER");
});
test("activation winning the race prevents removal", async () => {
  reset("draft");
  beforeBatch = () =>
    database.prepare("UPDATE vaults SET status='activating'").run();
  assert.equal(
    (await request("removeMember", { address: addresses[1] })).data.error,
    "CONFIGURATION_CHANGED",
  );
  assert.deepEqual(members(), addresses.slice(0, 3).sort());
});
for (const replace of [false, true])
  test(`removal ${replace ? "and replacement " : ""}during preparation prevents stale activation`, async () => {
    reset("draft");
    beforePrepare = () => {
      database.prepare("DELETE FROM members WHERE address=?").run(addresses[1]);
      if (replace)
        database
          .prepare("INSERT INTO members VALUES('vault',?)")
          .run(addresses[3]);
    };
    assert.equal(
      (await request("prepareVault")).data.error,
      "CONFIGURATION_CHANGED",
    );
    assert.equal(stored().status, "draft");
    assert.equal(stored().setup, null);
  });
test("unchanged membership can prepare a vault", async () => {
  reset("draft");
  assert.equal((await request("prepareVault")).status, 200);
  assert.equal(stored().status, "activating");
});

function authRequest(ip = "192.0.2.1") {
  return new Request("http://localhost/api/auth", {
    headers: { "cf-connecting-ip": ip, Origin: "http://localhost" },
  });
}
async function issue(ip, address = addresses[0]) {
  return (await challenge(authRequest(ip), address)).json();
}
async function login(challengeData, key = keys[0]) {
  const tx = TransactionBuilder.fromXDR(
    challengeData.transaction,
    Networks.TESTNET,
  );
  tx.sign(key);
  return authenticate(authRequest(), tx.toXDR(), "Signed-in member");
}
test("same-account requests hit the per-client limit without evicting challenges", async () => {
  for (let n = 0; n < 30; n++) await issue("192.0.2.1");
  await assert.rejects(() => issue("192.0.2.1"), /RATE_LIMITED/);
  assert.equal(
    database.prepare("SELECT count(*) as n FROM challenges").get().n,
    30,
  );
  assert.equal(
    database.prepare("SELECT requests FROM auth_limits").get().requests,
    30,
  );
});
test("parallel challenges cannot exceed the caller budget", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 60 }, () => issue("192.0.2.1")),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 30);
  assert(
    results
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.message === "RATE_LIMITED"),
  );
});
test("another caller cannot cancel an outstanding signed login", async () => {
  const legitimate = await issue("192.0.2.2");
  for (let n = 0; n < 30; n++) await issue("192.0.2.1");
  await assert.rejects(() => issue("192.0.2.1"), /RATE_LIMITED/);
  assert.equal((await login(legitimate)).status, 200);
  await assert.rejects(() => login(legitimate), /EXPIRED_LOGIN/);
});
test("successful logins do not reset request limits", async () => {
  for (let n = 0; n < 30; n++)
    assert.equal((await login(await issue("192.0.2.1"))).status, 200);
  assert.equal(
    database.prepare("SELECT count(*) as n FROM challenges").get().n,
    0,
  );
  await assert.rejects(() => issue("192.0.2.1"), /RATE_LIMITED/);
});
test("a new client and an expired window can request challenges", async () => {
  for (let n = 0; n < 30; n++) await issue("192.0.2.1");
  await issue("192.0.2.2");
  database.prepare("UPDATE auth_limits SET expires=0").run();
  await issue("192.0.2.1");
  assert.equal(
    database.prepare("SELECT requests FROM auth_limits").get().requests,
    1,
  );
});
test("forwarded IP spoofing cannot change the trusted client budget", async () => {
  for (let n = 0; n < 30; n++) await issue("192.0.2.1");
  const req = authRequest();
  req.headers.set("x-forwarded-for", "198.51.100.99");
  await assert.rejects(() => challenge(req, addresses[1]), /RATE_LIMITED/);
});

// Gas sponsorship: only everyday operations on verified vaults, within limits.
function sponsorship(over = {}) {
  sponsorCall = {
    source: addresses[0],
    fee: 50_000n,
    contract,
    method: "approve",
    args: [addresses[0], 0n],
    ...over,
  };
  return request("sponsor", { signed: "signed-xdr" });
}
test("sponsorship is off without a sponsor key", async () => {
  reset("active");
  delete env.SPONSOR_SECRET;
  const r = await sponsorship();
  assert.equal(r.data.sponsored, false);
  assert.equal(r.data.reason, "OFF");
});
test("sponsors an approval on a verified vault and caps it per day", async () => {
  reset("active");
  env.SPONSOR_SECRET = sponsorKey.secret();
  sponsorXlm = 100;
  globalThis.__juntoAuditTests.bumps = 0;
  const first = await sponsorship();
  assert.equal(first.data.sponsored, true);
  assert.equal(first.data.hash, "bumped");
  for (let n = 1; n < 20; n++) await sponsorship();
  const over = await sponsorship();
  assert.equal(over.data.reason, "LIMIT");
  assert.equal(globalThis.__juntoAuditTests.bumps, 20);
});
test("never sponsors vault creation, other sources, big fees or unverified contracts", async () => {
  reset("active");
  env.SPONSOR_SECRET = sponsorKey.secret();
  sponsorXlm = 100;
  globalThis.__juntoAuditTests.bumps = 0;
  for (const over of [
    { method: "create", contract: factory },
    { source: addresses[1] },
    { fee: 20_000_000n },
    { method: "transfer", args: [addresses[0], contract, 1n] },
  ])
    assert.equal((await sponsorship(over)).data.reason, "NOT_ELIGIBLE");
  config = Error("UNVERIFIED_CONTRACT");
  assert.equal((await sponsorship()).data.reason, "NOT_ELIGIBLE");
  sponsorCall = Error("INVALID_TRANSACTION");
  assert.equal(
    (await request("sponsor", { signed: "x" })).data.reason,
    "NOT_ELIGIBLE",
  );
  assert.equal(globalThis.__juntoAuditTests.bumps, 0);
});
test("an empty sponsor falls back instead of failing", async () => {
  reset("active");
  env.SPONSOR_SECRET = sponsorKey.secret();
  sponsorXlm = 5;
  const r = await sponsorship();
  assert.equal(r.status, 200);
  assert.equal(r.data.reason, "EMPTY");
});
