import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";

import { validateOutputExceptions, validatePolicy } from "./lib/public-output-policy.mjs";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA256 = /^[a-f0-9]{64}$/;
const PUBLIC_FILES = [
  "security/public-output-policy.v1.json",
  "security/public-output-surfaces.marketing.v1.json",
  "security/public-output-surfaces.portal.v1.json",
];
const SCHEMA_FILES = {
  policy: "public-output-policy.schema.json",
  inventory: "public-output-surfaces.schema.json",
  manifest: "public-output-release-manifest.schema.json",
  exceptions: "private-output-exceptions.schema.json",
  routes: "private-retired-route-probes.schema.json",
};
const PROTECTED_PAIRS = [
  {
    digestEnv: "YONARIS_RETIRED_ROUTE_PROBE_SHA256",
    fileEnv: "YONARIS_RETIRED_ROUTE_PROBE_FILE",
    name: "routes",
  },
  {
    digestEnv: "YONARIS_OUTPUT_EXCEPTION_SHA256",
    fileEnv: "YONARIS_OUTPUT_EXCEPTION_FILE",
    name: "exceptions",
  },
];

const digest = (value) => createHash("sha256").update(value).digest("hex");

function fail(code) {
  throw new Error(code);
}

function isPublicError(error) {
  return error instanceof Error && /^PUBLIC_OUTPUT_[A-Z_]+$/.test(error.message);
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function readJsonInput(file, code) {
  try {
    const bytes = await readFile(file);
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    fail(code);
  }
}

async function compileTrackedSchemas(securityRoot) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validators = {};
  try {
    for (const [name, relative] of Object.entries(SCHEMA_FILES)) {
      const schema = JSON.parse(await readFile(path.join(securityRoot, relative), "utf8"));
      validators[name] = ajv.compile(schema);
    }
  } catch {
    fail("PUBLIC_OUTPUT_SCHEMA_INVALID");
  }
  return validators;
}

function requireValid(validator, value, code) {
  let valid = false;
  try {
    valid = validator(value);
  } catch {
    fail(code);
  }
  if (!valid) fail(code);
}

async function loadAndValidatePublicInputs(repositoryRoot, validators) {
  const securityRoot = path.join(repositoryRoot, "security");
  const manifestInput = await readJsonInput(
    path.join(securityRoot, "public-output-release-manifest.v1.json"),
    "PUBLIC_OUTPUT_MANIFEST_INVALID",
  );
  const policyInput = await readJsonInput(
    path.join(securityRoot, "public-output-policy.v1.json"),
    "PUBLIC_OUTPUT_POLICY_INVALID",
  );
  const marketingInput = await readJsonInput(
    path.join(securityRoot, "public-output-surfaces.marketing.v1.json"),
    "PUBLIC_OUTPUT_INVENTORY_INVALID",
  );
  const portalInput = await readJsonInput(
    path.join(securityRoot, "public-output-surfaces.portal.v1.json"),
    "PUBLIC_OUTPUT_INVENTORY_INVALID",
  );

  requireValid(validators.manifest, manifestInput.value, "PUBLIC_OUTPUT_MANIFEST_INVALID");
  requireValid(validators.policy, policyInput.value, "PUBLIC_OUTPUT_POLICY_INVALID");
  try {
    validatePolicy(policyInput.value);
  } catch {
    fail("PUBLIC_OUTPUT_POLICY_INVALID");
  }
  requireValid(validators.inventory, marketingInput.value, "PUBLIC_OUTPUT_INVENTORY_INVALID");
  requireValid(validators.inventory, portalInput.value, "PUBLIC_OUTPUT_INVENTORY_INVALID");
  if (
    marketingInput.value.surfaceClass !== "marketing" ||
    portalInput.value.surfaceClass !== "portal"
  ) {
    fail("PUBLIC_OUTPUT_INVENTORY_INVALID");
  }

  return {
    manifest: manifestInput.value,
    policy: policyInput.value,
    publicBytes: new Map([
      [PUBLIC_FILES[0], policyInput.bytes],
      [PUBLIC_FILES[1], marketingInput.bytes],
      [PUBLIC_FILES[2], portalInput.bytes],
    ]),
  };
}

function verifyPublicDigests(manifest, publicBytes) {
  const verified = {};
  for (const relative of PUBLIC_FILES) {
    const actual = digest(publicBytes.get(relative));
    if (manifest.publicFiles[relative] !== actual) {
      fail("PUBLIC_OUTPUT_PUBLIC_DIGEST_MISMATCH");
    }
    verified[relative] = actual;
  }
  return verified;
}

function optionalEnvironmentValue(env, name) {
  const value = env[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function resolveProtectedFile(repositoryRoot, suppliedPath) {
  const absolute = path.resolve(suppliedPath);
  if (isWithin(repositoryRoot, absolute)) fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
  try {
    const lexicalStat = await lstat(absolute);
    if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
      fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
    }
    const resolved = await realpath(absolute);
    if (isWithin(repositoryRoot, resolved)) fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
    const resolvedStat = await lstat(resolved);
    if (resolvedStat.isSymbolicLink() || !resolvedStat.isFile()) {
      fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
    }
    return resolved;
  } catch (error) {
    if (isPublicError(error)) throw error;
    fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
  }
}

async function loadProtectedPair(repositoryRoot, env, pair) {
  const fileValue = optionalEnvironmentValue(env, pair.fileEnv);
  const digestValue = optionalEnvironmentValue(env, pair.digestEnv);
  if (Boolean(fileValue) !== Boolean(digestValue)) {
    fail("PUBLIC_OUTPUT_PROTECTED_PAIR_INVALID");
  }
  if (!fileValue) return null;
  if (!SHA256.test(digestValue)) fail("PUBLIC_OUTPUT_PROTECTED_DIGEST_INVALID");
  const file = await resolveProtectedFile(repositoryRoot, fileValue);
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    fail("PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID");
  }
  if (digest(bytes) !== digestValue) fail("PUBLIC_OUTPUT_PROTECTED_DIGEST_MISMATCH");
  return { bytes, digest: digestValue };
}

async function resolveAttestationTarget(repositoryRoot, suppliedPath) {
  const absolute = path.resolve(suppliedPath);
  if (isWithin(repositoryRoot, absolute)) fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
  try {
    const lexicalStat = await lstat(absolute);
    if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
      fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
    }
    const resolved = await realpath(absolute);
    if (isWithin(repositoryRoot, resolved)) fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
    return resolved;
  } catch (error) {
    if (isPublicError(error)) throw error;
    if (error?.code !== "ENOENT") fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
  }

  try {
    const parent = await realpath(path.dirname(absolute));
    const parentStat = await lstat(parent);
    const target = path.join(parent, path.basename(absolute));
    if (!parentStat.isDirectory() || isWithin(repositoryRoot, parent) || isWithin(repositoryRoot, target)) {
      fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
    }
    return target;
  } catch (error) {
    if (isPublicError(error)) throw error;
    fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
  }
}

function parseProtectedJson(input, code) {
  if (!input) return null;
  try {
    return JSON.parse(input.bytes.toString("utf8"));
  } catch {
    fail(code);
  }
}

function normalizedSafeRoute(value) {
  let candidate = value;
  const rounds = typeof value === "string" ? value.length + 1 : 0;
  for (let index = 0; index < rounds; index += 1) {
    if (
      typeof candidate !== "string" ||
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.includes("?") ||
      candidate.includes("#") ||
      candidate.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(candidate) ||
      candidate.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return null;
    }
    if (decoded === candidate) return candidate;
    candidate = decoded;
  }
  return null;
}

function validateRetiredRoutes(routes) {
  const requiredIds = new Set(
    Array.from({ length: 26 }, (_, index) =>
      `retired_route_${String(index + 1).padStart(2, "0")}`,
    ),
  );
  const ids = new Set();
  const paths = new Set();
  for (const route of routes) {
    const normalized = normalizedSafeRoute(route.path);
    if (
      !requiredIds.has(route.id) ||
      ids.has(route.id) ||
      !normalized ||
      paths.has(normalized)
    ) {
      fail("PUBLIC_OUTPUT_ROUTE_PROBE_INVALID");
    }
    ids.add(route.id);
    paths.add(normalized);
  }
  if (ids.size !== requiredIds.size) fail("PUBLIC_OUTPUT_ROUTE_PROBE_INVALID");
}

async function writeAttestation(target, value) {
  const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | (fsConstants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(target, flags, 0o600);
    const targetStat = await handle.stat();
    if (!targetStat.isFile()) fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
    await handle.chmod(0o600);
    await handle.truncate(0);
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    if (isPublicError(error)) throw error;
    fail("PUBLIC_OUTPUT_ATTESTATION_INVALID");
  } finally {
    await handle?.close();
  }
}

export async function verifyPublicOutputRelease({
  repositoryRoot = scriptRoot,
  env = process.env,
  now = new Date(),
} = {}) {
  try {
    const verifiedAt = now instanceof Date ? new Date(now.getTime()) : new Date(now);
    if (!Number.isFinite(verifiedAt.getTime())) fail("PUBLIC_OUTPUT_VERIFY_FAILED");
    const resolvedRepository = await realpath(repositoryRoot);
    const securityRoot = path.join(resolvedRepository, "security");

    const validators = await compileTrackedSchemas(securityRoot);
    const { manifest, policy, publicBytes } = await loadAndValidatePublicInputs(
      resolvedRepository,
      validators,
    );
    const publicDigests = verifyPublicDigests(manifest, publicBytes);

    const protectedInputs = {};
    for (const pair of PROTECTED_PAIRS) {
      protectedInputs[pair.name] = await loadProtectedPair(resolvedRepository, env, pair);
    }
    const attestationValue = optionalEnvironmentValue(env, "YONARIS_RELEASE_ATTESTATION_FILE");
    const attestationTarget = attestationValue
      ? await resolveAttestationTarget(resolvedRepository, attestationValue)
      : null;

    const exceptions = parseProtectedJson(
      protectedInputs.exceptions,
      "PUBLIC_OUTPUT_EXCEPTION_INVALID",
    );
    const routes = parseProtectedJson(
      protectedInputs.routes,
      "PUBLIC_OUTPUT_ROUTE_PROBE_INVALID",
    );
    if (exceptions) {
      requireValid(validators.exceptions, exceptions, "PUBLIC_OUTPUT_EXCEPTION_INVALID");
    }
    if (routes) requireValid(validators.routes, routes, "PUBLIC_OUTPUT_ROUTE_PROBE_INVALID");

    try {
      validateOutputExceptions({ policy, exceptions: exceptions ?? [], now: verifiedAt });
    } catch {
      fail("PUBLIC_OUTPUT_EXCEPTION_INVALID");
    }
    if (routes) validateRetiredRoutes(routes);

    const attestation = {
      policyDigest: publicDigests[PUBLIC_FILES[0]],
      marketingInventoryDigest: publicDigests[PUBLIC_FILES[1]],
      portalInventoryDigest: publicDigests[PUBLIC_FILES[2]],
      retiredRouteProbeDigest: protectedInputs.routes?.digest ?? null,
      legalExceptionDigest: protectedInputs.exceptions?.digest ?? null,
      ownerRole: manifest.ownerRole,
      verifiedAt: verifiedAt.toISOString(),
    };
    if (attestationTarget) await writeAttestation(attestationTarget, attestation);
    return attestation;
  } catch (error) {
    if (isPublicError(error)) throw error;
    fail("PUBLIC_OUTPUT_VERIFY_FAILED");
  }
}

function isDirectExecution() {
  return (
    typeof process.argv[1] === "string" &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isDirectExecution()) {
  try {
    if (process.argv.length !== 2) fail("PUBLIC_OUTPUT_VERIFY_USAGE");
    await verifyPublicOutputRelease();
  } catch (error) {
    const code = isPublicError(error) ? error.message : "PUBLIC_OUTPUT_VERIFY_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 2;
  }
}
