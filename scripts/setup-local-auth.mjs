import { Keypair } from "@stellar/stellar-sdk";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
const target = new URL("../.dev.vars", import.meta.url);
const current = existsSync(target) ? readFileSync(target, "utf8") : "";
if (!/^STELLAR_AUTH_SIGNING_SEED=/m.test(current)) {
  appendFileSync(
    target,
    `\nSTELLAR_AUTH_SIGNING_SEED=${Keypair.random().secret()}\n`,
    { mode: 0o600 },
  );
}
if (!/^STELLAR_AUTH_ORIGIN=/m.test(current)) {
  appendFileSync(target, "STELLAR_AUTH_ORIGIN=http://localhost:8789\n", {
    mode: 0o600,
  });
}
console.log("Local SEP-10 configuration ready in .dev.vars (ignored by Git).");
