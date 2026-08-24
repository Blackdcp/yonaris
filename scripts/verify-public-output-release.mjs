import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const manifest = JSON.parse(await readFile(path.join(root, "security/public-output-release-manifest.v1.json"), "utf8"));
if (manifest.ownerRole !== "release-owner") throw new Error("Manifest owner role is required");
for (const [file, expected] of Object.entries(manifest.publicFiles)) {
  if (await sha256(path.join(root, file)) !== expected) throw new Error(`Digest mismatch: ${file}`);
}
for (const [digestEnv, fileEnv, label] of [["YONARIS_RETIRED_ROUTE_PROBE_SHA256", "YONARIS_RETIRED_ROUTE_PROBE_FILE", "route probes"], ["YONARIS_OUTPUT_EXCEPTION_SHA256", "YONARIS_OUTPUT_EXCEPTION_FILE", "exceptions"]]) {
  const expected = process.env[digestEnv];
  const protectedFile = process.env[fileEnv];
  if (Boolean(expected) !== Boolean(protectedFile)) throw new Error(`Protected ${label} file and digest must be supplied together`);
  if (expected && (!/^[a-f0-9]{64}$/i.test(expected) || await sha256(protectedFile) !== expected)) throw new Error(`Protected ${label} digest mismatch`);
}
if (process.env.YONARIS_OUTPUT_EXCEPTION_FILE) {
  const exceptions = JSON.parse(await readFile(process.env.YONARIS_OUTPUT_EXCEPTION_FILE, "utf8"));
  for (const exception of exceptions) {
    if (exception.approvedByRole !== "release-owner" || !exception.legalBasisReference || new Date(exception.expiresAt) <= new Date()) throw new Error("Invalid legal exception");
  }
}
if (process.env.YONARIS_RELEASE_ATTESTATION_FILE) await writeFile(process.env.YONARIS_RELEASE_ATTESTATION_FILE, JSON.stringify({ policyDigest: manifest.publicFiles["security/public-output-policy.v1.json"], ownerRole: manifest.ownerRole }));
