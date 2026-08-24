import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import Ajv from "ajv";

const exec = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/i;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  hyphen: "-",
  lt: "<",
  lowbar: "_",
  newline: "\n",
  nbsp: " ",
  quot: '"',
  sol: "/",
  tab: "\t",
};
const ENTITY = /&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));?/gi;
const ESCAPE = /\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2}))/gi;
const SEPARATOR = /[\/_\-\s\p{P}]+/gu;
const HARD_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".pnpm",
  ".superpowers",
  "bower_components",
  "node_modules",
  "vendor",
]);
const MAX_DECODE_ROUNDS = 16;
const MAX_NORMALIZATION_INPUT_LENGTH = 1_048_576;
const MAX_FINGERPRINTS = 256;
const MAX_CHARACTERS = 256;
const MAX_TOKENS = 16;
const MAX_COMPACT_VARIANTS = 1024;
const EXCEPTION_SHA256 = /^[a-f0-9]{64}$/;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(code);
};

function decodeOnce(value) {
  return value
    .replace(ENTITY, (raw, hex, decimal, named) => {
      const number = hex || decimal;
      if (number) {
        try {
          return String.fromCodePoint(Number.parseInt(number, hex ? 16 : 10));
        } catch {
          return raw;
        }
      }
      return ENTITIES[named.toLowerCase()] ?? raw;
    })
    .replace(/%(?:[0-9a-f]{2})+/gi, (raw) => {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })
    .replace(ESCAPE, (raw, point, unicode, hex) => {
      try {
        return String.fromCodePoint(Number.parseInt(point || unicode || hex, 16));
      } catch {
        return raw;
      }
    });
}

export function normalizePublicText(value) {
  let decoded = String(value);
  if (decoded.length > MAX_NORMALIZATION_INPUT_LENGTH) {
    fail("PUBLIC_OUTPUT_NORMALIZATION_LIMIT");
  }
  let settled = false;
  for (let index = 0; index < MAX_DECODE_ROUNDS; index += 1) {
    const next = decodeOnce(decoded);
    if (next.length > MAX_NORMALIZATION_INPUT_LENGTH) {
      fail("PUBLIC_OUTPUT_NORMALIZATION_LIMIT");
    }
    if (next === decoded) {
      settled = true;
      break;
    }
    decoded = next;
  }
  if (!settled && decodeOnce(decoded) !== decoded) {
    fail("PUBLIC_OUTPUT_NORMALIZATION_LIMIT");
  }
  const normalized = decoded
    .normalize("NFKC")
    .toLowerCase()
    .replace(ZERO_WIDTH, "")
    .replace(SEPARATOR, " ")
    .trim();
  if (normalized.length > MAX_NORMALIZATION_INPUT_LENGTH) {
    fail("PUBLIC_OUTPUT_NORMALIZATION_LIMIT");
  }
  return normalized;
}

function tokenizeNormalizedPublicText(normalized) {
  const tokens = [];
  for (const match of normalized.matchAll(/[\p{L}\p{N}]+/gu)) {
    tokens.push({ offset: match.index, value: match[0] });
  }
  return tokens;
}

export function tokenizePublicText(value) {
  return tokenizeNormalizedPublicText(normalizePublicText(value)).map((token) => token.value);
}

export function validatePolicy(policy) {
  if (
    !policy ||
    policy.policyVersion !== 1 ||
    policy.normalizationVersion !== 1 ||
    policy.ownerRole !== "release-owner" ||
    !Array.isArray(policy.surfaceClasses) ||
    !Array.isArray(policy.fingerprints) ||
    policy.fingerprints.length > MAX_FINGERPRINTS
  ) {
    fail("PUBLIC_OUTPUT_POLICY_INVALID");
  }
  const ids = new Set();
  for (const item of policy.fingerprints) {
    if (
      !item ||
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      !SHA256.test(item.sha256) ||
      !Number.isInteger(item.characters) ||
      item.characters < 1 ||
      item.characters > MAX_CHARACTERS ||
      !Number.isInteger(item.tokens) ||
      item.tokens < 1 ||
      item.tokens > MAX_TOKENS ||
      item.characters - (item.tokens - 1) < item.tokens ||
      compactVariantCount(item.characters - (item.tokens - 1), item.tokens) >
        MAX_COMPACT_VARIANTS ||
      item.severity !== "block" ||
      Object.keys(item).length !== 5
    ) {
      fail("PUBLIC_OUTPUT_POLICY_INVALID");
    }
    ids.add(item.id);
  }
  return policy;
}

function parseUtcTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return null;
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6]) ||
    date.getUTCMilliseconds() !== Number((match[7] ?? "0").padEnd(3, "0"))
  ) {
    return null;
  }
  return date;
}

export function validateOutputExceptions({ policy, exceptions = [], now = new Date() }) {
  validatePolicy(policy);
  const verifiedAt = now instanceof Date ? now : new Date(now);
  if (!Array.isArray(exceptions) || !Number.isFinite(verifiedAt.getTime())) {
    fail("PUBLIC_OUTPUT_EXCEPTION_INVALID");
  }
  const fingerprintIds = new Set(policy.fingerprints.map((item) => item.id));
  const seenTargets = new Set();
  const allowedKeys = new Set([
    "fingerprintId",
    "exactPathSha256",
    "artifactSha256",
    "legalBasisReference",
    "approvedByRole",
    "approvedAt",
    "expiresAt",
  ]);
  for (const exception of exceptions) {
    const approvedAt = parseUtcTimestamp(exception?.approvedAt);
    const expiresAt = parseUtcTimestamp(exception?.expiresAt);
    if (
      !exception ||
      typeof exception !== "object" ||
      Array.isArray(exception) ||
      Object.keys(exception).some((key) => !allowedKeys.has(key)) ||
      !fingerprintIds.has(exception.fingerprintId) ||
      exception.approvedByRole !== "release-owner" ||
      typeof exception.legalBasisReference !== "string" ||
      exception.legalBasisReference.trim().length === 0 ||
      (exception.exactPathSha256 !== undefined &&
        !EXCEPTION_SHA256.test(exception.exactPathSha256)) ||
      (exception.artifactSha256 !== undefined &&
        !EXCEPTION_SHA256.test(exception.artifactSha256)) ||
      (exception.exactPathSha256 === undefined && exception.artifactSha256 === undefined) ||
      !approvedAt ||
      !expiresAt ||
      approvedAt > verifiedAt ||
      expiresAt <= verifiedAt ||
      approvedAt >= expiresAt
    ) {
      fail("PUBLIC_OUTPUT_EXCEPTION_INVALID");
    }
    for (const [targetType, targetDigest] of [
      ["path", exception.exactPathSha256],
      ["artifact", exception.artifactSha256],
    ]) {
      if (!targetDigest) continue;
      const key = `${exception.fingerprintId}:${targetType}:${targetDigest}`;
      if (seenTargets.has(key)) fail("PUBLIC_OUTPUT_EXCEPTION_INVALID");
      seenTargets.add(key);
    }
  }
  return exceptions;
}

function compactVariantCount(characters, tokens) {
  let count = 1;
  const selections = Math.min(tokens - 1, characters - tokens);
  for (let index = 1; index <= selections; index += 1) {
    count = (count * (characters - index)) / index;
    if (count > MAX_COMPACT_VARIANTS) return count;
  }
  return count;
}

function matchesFingerprint(compact, item) {
  let variants = 0;
  let matched = false;
  const visit = (start, remaining, segments) => {
    if (matched || variants >= MAX_COMPACT_VARIANTS) return;
    if (remaining === 1) {
      variants += 1;
      const candidate = [...segments, compact.slice(start)].join(" ");
      matched = digest(candidate) === item.sha256;
      return;
    }
    const lastEnd = compact.length - remaining + 1;
    for (let end = start + 1; end <= lastEnd; end += 1) {
      visit(end, remaining - 1, [...segments, compact.slice(start, end)]);
      if (matched || variants >= MAX_COMPACT_VARIANTS) return;
    }
  };
  visit(0, item.tokens, []);
  return matched;
}

export function scanPublicText({ policy, surface, source, text }) {
  validatePolicy(policy);
  const normalized = normalizePublicText(text);
  const positionedTokens = tokenizeNormalizedPublicText(normalized);
  const tokens = positionedTokens.map((token) => token.value);
  const findings = [];
  for (const item of policy.fingerprints) {
    const compactCharacters = item.characters - (item.tokens - 1);
    let match = -1;
    for (let start = 0; start < tokens.length && match < 0; start += 1) {
      for (let end = start + 1; end <= tokens.length; end += 1) {
        const window = tokens.slice(start, end);
        const compact = window.join("");
        const spaced = window.join(" ");
        if (
          compact.length === compactCharacters &&
          ((window.length === item.tokens && digest(spaced) === item.sha256) ||
            matchesFingerprint(compact, item))
        ) {
          match = positionedTokens[start].offset;
          break;
        }
        if (compact.length >= compactCharacters) break;
      }
    }
    if (match >= 0) {
      findings.push({ id: item.id, severity: "block", surface, source, offset: match });
    }
  }
  return findings.sort(
    (left, right) =>
      left.id.localeCompare(right.id) ||
      left.source.localeCompare(right.source) ||
      left.offset - right.offset,
  );
}

function isPublicError(error) {
  return error instanceof Error && /^PUBLIC_OUTPUT_[A-Z_]+$/.test(error.message);
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function matchesPrefix(relative, prefix) {
  return prefix === "." || relative === prefix || relative.startsWith(`${prefix}/`);
}

function isPrefixAncestor(relative, prefix) {
  return prefix !== "." && prefix.startsWith(`${relative}/`);
}

function isHardExcluded(relative) {
  return relative.split("/").some((part) => HARD_EXCLUDED_DIRECTORIES.has(part));
}

function isSelected(relative, config) {
  return (
    !isHardExcluded(relative) &&
    config.allowedRoots.some((entry) => matchesPrefix(relative, entry)) &&
    config.include.some((entry) => matchesPrefix(relative, entry)) &&
    !config.exclude.some((entry) => matchesPrefix(relative, entry))
  );
}

function canContainSelection(relative, config) {
  return config.include.some(
    (entry) => matchesPrefix(relative, entry) || isPrefixAncestor(relative, entry),
  );
}

function validateInventory(inventory, schema, phase) {
  let valid = false;
  try {
    valid = new Ajv({ allErrors: true, strict: true }).compile(schema)(inventory);
  } catch {
    fail("PUBLIC_OUTPUT_INVENTORY_INVALID");
  }
  if (!valid || !["source", "artifact", "image-root"].includes(phase)) {
    fail("PUBLIC_OUTPUT_INVENTORY_INVALID");
  }
  return inventory.phases[phase];
}

export function assertWithinPublicBoundary(boundary, candidate) {
  const relative = path.relative(path.resolve(boundary), path.resolve(candidate));
  if (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  ) {
    return;
  }
  fail("PUBLIC_OUTPUT_OUT_OF_ROOT");
}

async function rejectRootSymlink(root) {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    fail("PUBLIC_OUTPUT_SCAN_FAILED");
  }
  if (stat.isSymbolicLink()) fail("PUBLIC_OUTPUT_SYMLINK");
}

async function sourcePaths(root, config) {
  let topLevel;
  try {
    const result = await exec("git", ["-C", root, "rev-parse", "--show-toplevel"]);
    topLevel = await realpath(result.stdout.trim());
  } catch {
    fail("PUBLIC_OUTPUT_NOT_GIT_ROOT");
  }
  if (path.relative(root, topLevel) !== "") fail("PUBLIC_OUTPUT_NOT_GIT_ROOT");

  let stdout;
  try {
    ({ stdout } = await exec("git", [
      "-C",
      topLevel,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ]));
  } catch {
    fail("PUBLIC_OUTPUT_SCAN_FAILED");
  }
  const results = [];
  for (const entry of stdout.split("\0").filter(Boolean)) {
    const relative = normalizeRelativePath(entry);
    if (!isSelected(relative, config)) continue;
    const target = path.resolve(topLevel, ...relative.split("/"));
    assertWithinPublicBoundary(topLevel, target);
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) fail("PUBLIC_OUTPUT_SYMLINK");
    if (!stat.isFile()) continue;
    const resolved = await realpath(target);
    assertWithinPublicBoundary(topLevel, resolved);
    results.push({ relative, target: resolved });
  }
  return results;
}

async function walkAllowedPath(boundary, target, config, files, seen) {
  const relative = normalizeRelativePath(path.relative(boundary, target));
  if (relative && (isHardExcluded(relative) || config.exclude.some((entry) => matchesPrefix(relative, entry)))) {
    return;
  }
  if (relative && !isSelected(relative, config) && !canContainSelection(relative, config)) return;

  let stat;
  try {
    stat = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (stat.isSymbolicLink()) fail("PUBLIC_OUTPUT_SYMLINK");
  const resolved = await realpath(target);
  assertWithinPublicBoundary(boundary, resolved);
  if (stat.isDirectory()) {
    for (const entry of await readdir(resolved)) {
      await walkAllowedPath(boundary, path.join(resolved, entry), config, files, seen);
    }
  } else if (stat.isFile() && isSelected(relative || ".", config) && !seen.has(resolved)) {
    seen.add(resolved);
    files.push({ relative: relative || path.basename(resolved), target: resolved });
  }
}

async function artifactPaths(root, config) {
  const files = [];
  const seen = new Set();
  for (const allowedRoot of config.allowedRoots) {
    const target =
      allowedRoot === "." ? root : path.resolve(root, ...normalizeRelativePath(allowedRoot).split("/"));
    assertWithinPublicBoundary(root, target);
    await walkAllowedPath(root, target, config, files, seen);
  }
  return files;
}

async function readJson(file, errorCode) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail(errorCode);
  }
}

function sortFindings(findings) {
  return findings.sort(
    (left, right) =>
      left.id.localeCompare(right.id) ||
      left.source.localeCompare(right.source) ||
      left.offset - right.offset,
  );
}

export async function scanPaths({
  policyPath,
  inventoryPath,
  phase,
  root,
  exceptions = [],
  now = new Date(),
} = {}) {
  try {
    if (typeof root !== "string" || root.length === 0) fail("PUBLIC_OUTPUT_ROOT_REQUIRED");
    await rejectRootSymlink(root);
    const resolvedRoot = await realpath(root);

    const policy = await readJson(policyPath, "PUBLIC_OUTPUT_POLICY_INVALID");
    const policySchema = await readJson(
      path.join(path.dirname(policyPath), "public-output-policy.schema.json"),
      "PUBLIC_OUTPUT_POLICY_INVALID",
    );
    let policySchemaValid = false;
    try {
      policySchemaValid = new Ajv({ allErrors: true, strict: true }).compile(policySchema)(policy);
    } catch {
      fail("PUBLIC_OUTPUT_POLICY_INVALID");
    }
    if (!policySchemaValid) fail("PUBLIC_OUTPUT_POLICY_INVALID");
    validatePolicy(policy);
    validateOutputExceptions({ policy, exceptions, now });

    const inventoryValue = await readJson(inventoryPath, "PUBLIC_OUTPUT_INVENTORY_INVALID");
    const inventorySchema = await readJson(
      path.join(path.dirname(inventoryPath), "public-output-surfaces.schema.json"),
      "PUBLIC_OUTPUT_INVENTORY_INVALID",
    );
    const config = validateInventory(inventoryValue, inventorySchema, phase);
    const files =
      phase === "source"
        ? await sourcePaths(resolvedRoot, config)
        : await artifactPaths(resolvedRoot, config);
    const findings = [];
    for (const { relative, target } of files) {
      const buffer = await readFile(target);
      if (buffer.includes(0) && config.binaryStrategy === "reject") {
        fail("PUBLIC_OUTPUT_BINARY_REJECTED");
      }
      const fileFindings = scanPublicText({
        policy,
        surface: config.surface,
        source: relative,
        text: buffer.toString("utf8"),
      });
      if (phase !== "source" || exceptions.length === 0) {
        findings.push(...fileFindings);
        continue;
      }
      const pathDigest = digest(relative);
      const artifactDigest = digest(buffer);
      for (const finding of fileFindings) {
        const suppressed = exceptions.some(
          (exception) =>
            exception.fingerprintId === finding.id &&
            (exception.exactPathSha256 === pathDigest ||
              exception.artifactSha256 === artifactDigest),
        );
        if (!suppressed) findings.push(finding);
      }
    }
    return sortFindings(findings);
  } catch (error) {
    if (isPublicError(error)) throw error;
    fail("PUBLIC_OUTPUT_SCAN_FAILED");
  }
}
