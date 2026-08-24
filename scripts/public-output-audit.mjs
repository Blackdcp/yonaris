import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPaths } from "./lib/public-output-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage =
  "Usage: public-output-audit [--phase source|artifact|image-root] [--root path] [--portal]";

function usageError() {
  throw new Error("PUBLIC_OUTPUT_USAGE");
}

function parseArguments(args) {
  let phase = "source";
  let target = process.cwd();
  let portal = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--portal") {
      portal = true;
      continue;
    }
    if (argument === "--phase" || argument === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) usageError();
      index += 1;
      if (argument === "--phase") phase = value;
      else target = path.resolve(value);
      continue;
    }
    usageError();
  }
  if (!["source", "artifact", "image-root"].includes(phase)) usageError();
  return { phase, portal, target };
}

async function main() {
  const { phase, portal, target } = parseArguments(process.argv.slice(2));
  const inventory = portal
    ? "public-output-surfaces.portal.v1.json"
    : "public-output-surfaces.marketing.v1.json";
  const findings = await scanPaths({
    policyPath: path.join(repositoryRoot, "security", "public-output-policy.v1.json"),
    inventoryPath: path.join(repositoryRoot, "security", inventory),
    phase,
    root: target,
  });
  process.stdout.write(`${JSON.stringify(findings)}\n`);
  process.exitCode = findings.length ? 1 : 0;
}

try {
  await main();
} catch (error) {
  const code = /^PUBLIC_OUTPUT_[A-Z_]+$/.test(error?.message)
    ? error.message
    : "PUBLIC_OUTPUT_SCAN_FAILED";
  if (code === "PUBLIC_OUTPUT_USAGE") process.stderr.write(`${code}\n${usage}\n`);
  else process.stderr.write(`${code}\n`);
  process.exitCode = 2;
}
