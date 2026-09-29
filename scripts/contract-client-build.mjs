import { build } from "esbuild";
await build({
  entryPoints: ["lib/contracts.ts"],
  outfile: "qa/contracts.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  target: "node22",
});
