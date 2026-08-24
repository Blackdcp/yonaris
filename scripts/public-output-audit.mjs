import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPaths } from "./lib/public-output-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const phase = args[args.indexOf("--phase") + 1] ?? "source";
const inventory = args.includes("--portal") ? "public-output-surfaces.portal.v1.json" : "public-output-surfaces.marketing.v1.json";
const target = args[args.indexOf("--root") + 1] ?? root;
const findings = await scanPaths({ policyPath: path.join(root, "security/public-output-policy.v1.json"), inventoryPath: path.join(root, "security", inventory), phase, root: target });
process.stdout.write(`${JSON.stringify(findings)}\n`);
process.exitCode = findings.length ? 1 : 0;
