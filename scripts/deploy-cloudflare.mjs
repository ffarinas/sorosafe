// Deploys the built app to Cloudflare Workers with its own D1 database.
// Usage: npm run build && node scripts/deploy-cloudflare.mjs [--first]
//   --first  also creates the auth signing secret (only on the first deploy:
//            rotating it signs everyone out).
// Requires `npx wrangler login`. Never prints or stores the signing seed.
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { Keypair } from "@stellar/stellar-sdk";

const { values: v } = parseArgs({
  options: { first: { type: "boolean", default: false } },
});
const demo = JSON.parse(
  await readFile("docs/testnet-demo-factory.json", "utf8"),
);
const target = {
  worker: "sorosafe-testnet",
  database: "sorosafe-testnet",
  domain: "testnet.sorosafe.app",
  network: "testnet",
  factory: demo.factory,
};
const wrangler = (args, input) => {
  const r = spawnSync("npx", ["wrangler", ...args], {
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "inherit"],
  });
  if (r.status !== 0)
    throw Error(`wrangler ${args[0]} ${args[1] ?? ""} failed`);
  return r.stdout;
};

// One D1 database per environment; reuse it when it already exists.
const list = JSON.parse(wrangler(["d1", "list", "--json"]));
let database = list.find((d) => d.name === target.database);
if (!database) {
  wrangler(["d1", "create", target.database]);
  database = JSON.parse(wrangler(["d1", "list", "--json"])).find(
    (d) => d.name === target.database,
  );
}
const built = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const config = {
  ...built,
  name: target.worker,
  topLevelName: target.worker,
  d1_databases: [
    {
      binding: "DB",
      database_name: target.database,
      database_id: database.uuid,
      migrations_dir: "../../drizzle",
    },
  ],
  vars: {
    JUNTO_NETWORK: target.network,
    JUNTO_FACTORY: target.factory,
    STELLAR_AUTH_ORIGIN: `https://${target.domain}`,
  },
  routes: [{ pattern: target.domain, custom_domain: true }],
};
const path = "dist/server/wrangler.deploy.json";
await writeFile(path, JSON.stringify(config, null, 2));
// Applies only migrations not yet recorded in the remote database.
wrangler([
  "d1",
  "migrations",
  "apply",
  target.database,
  "--remote",
  "--config",
  path,
]);
console.log(wrangler(["deploy", "--config", path]));
if (v.first)
  wrangler(
    ["secret", "put", "STELLAR_AUTH_SIGNING_SEED", "--config", path],
    Keypair.random().secret(),
  );
console.log(`Deployed https://${target.domain}`);
