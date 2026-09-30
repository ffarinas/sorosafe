import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
// Vaults are immutable: contracts already deployed keep their code. Earlier
// hashes stay accepted so a rebuild never locks users out of existing vaults.
const earlier = JSON.parse(
  await readFile("lib/contract-artifacts.json", "utf8").catch(() => "{}"),
);
const records = {};
await mkdir("public/contracts", { recursive: true });
for (const name of ["vault", "factory"]) {
  const bytes = await readFile(
    `contracts/target/wasm32v1-none/release/junto_${name}.wasm`,
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(`public/contracts/junto_${name}.wasm`, bytes);
  const old = earlier[name];
  const previous = [
    ...(old?.previous ?? []),
    ...(old && old.sha256 !== sha256 ? [old.sha256] : []),
  ].filter((hash) => hash !== sha256);
  records[name] = {
    sha256,
    bytes: bytes.length,
    ...(previous.length ? { previous } : {}),
  };
}
await writeFile(
  "lib/contract-artifacts.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log(records);
