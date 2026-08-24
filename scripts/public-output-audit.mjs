import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPaths } from "./lib/public-output-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2); let phase = "source"; let target = root; let portal = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--portal") { portal = true; continue; }
  if (argument === "--phase" || argument === "--root") { const value = args[++index]; if (!value || value.startsWith("--")) throw new Error("Usage: public-output-audit [--phase source|artifact|image-root] [--root path] [--portal]"); if (argument === "--phase") phase = value; else target = path.resolve(value); continue; }
  throw new Error("Usage: public-output-audit [--phase source|artifact|image-root] [--root path] [--portal]");
}
if (!["source", "artifact", "image-root"].includes(phase)) throw new Error("Usage: public-output-audit [--phase source|artifact|image-root] [--root path] [--portal]");
const inventory = portal ? "public-output-surfaces.portal.v1.json" : "public-output-surfaces.marketing.v1.json";
const findings = await scanPaths({ policyPath: path.join(root, "security/public-output-policy.v1.json"), inventoryPath: path.join(root, "security", inventory), phase, root: target });
process.stdout.write(`${JSON.stringify(findings)}\n`);
process.exitCode = findings.length ? 1 : 0;
