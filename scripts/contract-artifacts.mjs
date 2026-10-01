import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const records = {};
await mkdir("public/contracts", { recursive: true });
for (const name of ["vault", "factory"]) {
  const bytes = await readFile(
    `contracts/target/wasm32v1-none/release/junto_${name}.wasm`,
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(`public/contracts/junto_${name}.wasm`, bytes);
  records[name] = { sha256, bytes: bytes.length };
}
await writeFile(
  "lib/contract-artifacts.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log(records);
