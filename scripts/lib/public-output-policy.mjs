import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";

const exec = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/i;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const ENTITIES = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
const entity = /&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));?/gi;
const escape = /\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2}))/gi;
const separator = /[\/_\-\s\p{P}]+/gu;
const digest = (value) => createHash("sha256").update(value).digest("hex");
function spacedVariants(compact, parts) {
  const results = [];
  const visit = (start, remaining, segments) => {
    if (remaining === 1) { results.push([...segments, compact.slice(start)].join(" ")); return; }
    for (let end = start + 1; end <= compact.length - remaining + 1; end += 1) visit(end, remaining - 1, [...segments, compact.slice(start, end)]);
  };
  visit(0, parts, []); return results;
}

function decodeOnce(value) {
  return value.replace(entity, (raw, hex, decimal, named) => {
    const number = hex || decimal;
    if (number) { try { return String.fromCodePoint(Number.parseInt(number, hex ? 16 : 10)); } catch { return raw; } }
    return ENTITIES[named.toLowerCase()] ?? raw;
  }).replace(/%(?:[0-9a-f]{2})+/gi, (raw) => { try { return decodeURIComponent(raw); } catch { return raw; } })
    .replace(escape, (raw, point, unicode, hex) => { try { return String.fromCodePoint(Number.parseInt(point || unicode || hex, 16)); } catch { return raw; } });
}

export function normalizePublicText(value) {
  let decoded = String(value);
  for (let index = 0; index < 4; index += 1) { const next = decodeOnce(decoded); if (next === decoded) break; decoded = next; }
  return decoded.normalize("NFKC").toLowerCase().replace(ZERO_WIDTH, "").replace(separator, " ").trim();
}
export function tokenizePublicText(value) { return normalizePublicText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean); }
export function validatePolicy(policy) {
  if (!policy || policy.policyVersion !== 1 || policy.normalizationVersion !== 1 || policy.ownerRole !== "release-owner" || !Array.isArray(policy.surfaceClasses) || !Array.isArray(policy.fingerprints)) throw new Error("Invalid public output policy");
  const ids = new Set();
  for (const item of policy.fingerprints) {
    if (!item || typeof item.id !== "string" || ids.has(item.id) || !SHA256.test(item.sha256) || !Number.isInteger(item.characters) || item.characters < 1 || !Number.isInteger(item.tokens) || item.tokens < 1 || item.severity !== "block" || Object.keys(item).length !== 5) throw new Error("Invalid public output fingerprint");
    ids.add(item.id);
  }
  return policy;
}
export function scanPublicText({ policy, surface, source, text }) {
  if (!policy || !Array.isArray(policy.fingerprints)) throw new Error("Invalid scan policy"); const normalized = normalizePublicText(text); const tokens = tokenizePublicText(normalized); const findings = [];
  for (const item of policy.fingerprints) {
    let match = -1;
    for (let index = 0; index + item.tokens <= tokens.length; index += 1) { const candidate = tokens.slice(index, index + item.tokens).join(" "); if (candidate.length === item.characters && digest(candidate) === item.sha256) { match = normalized.indexOf(candidate); break; } }
    if (match < 0) for (const token of tokens) if (token.length === item.characters - (item.tokens - 1) && spacedVariants(token, item.tokens).some((candidate) => digest(candidate) === item.sha256)) { match = normalized.indexOf(token); break; }
    if (match >= 0) findings.push({ id: item.id, severity: "block", surface, source, offset: match });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id) || a.source.localeCompare(b.source) || a.offset - b.offset);
}
function validateInventory(inventory, phase) {
  const config = inventory?.phases?.[phase];
  if (!inventory || !["marketing", "portal"].includes(inventory.surfaceClass) || !config || !["source", "artifact", "image-root"].includes(phase) || typeof config.surface !== "string" || !Array.isArray(config.allowedRoots) || !Array.isArray(config.exclude)) throw new Error("Invalid public surface inventory");
  return config;
}
const ignored = (relative, config) => relative.split(path.sep).some((part) => [".git", "node_modules", ".superpowers"].includes(part)) || config.exclude.some((entry) => relative === entry || relative.startsWith(`${entry}/`));
const binary = (buffer) => buffer.includes(0);
async function walk(root, files = []) { for (const entry of await readdir(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isSymbolicLink()) continue; if (entry.isDirectory()) await walk(target, files); else if (entry.isFile()) files.push(target); } return files; }
export async function scanPaths({ policyPath, inventoryPath, phase, root }) {
  const policy = JSON.parse(await readFile(policyPath, "utf8")); const schemaPath = path.join(path.dirname(policyPath), "public-output-policy.schema.json"); const schema = JSON.parse(await readFile(schemaPath, "utf8")); const check = new Ajv({ allErrors: true, strict: true }).compile(schema); if (!check(policy)) throw new Error("Invalid public output policy schema"); validatePolicy(policy); const inventory = JSON.parse(await readFile(inventoryPath, "utf8")); const config = validateInventory(inventory, phase); const resolvedRoot = await realpath(root);
  let paths;
  if (phase === "source") { const { stdout } = await exec("git", ["-C", resolvedRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z"]); paths = stdout.split("\0").filter(Boolean).map((entry) => path.join(resolvedRoot, entry)); }
  else paths = await walk(resolvedRoot);
  const findings = [];
  for (const target of paths) { const relative = path.relative(resolvedRoot, target); if (ignored(relative, config)) continue; const resolved = await realpath(target); if (!resolved.startsWith(`${resolvedRoot}${path.sep}`) && resolved !== resolvedRoot) throw new Error("Out-of-root public path"); const buffer = await readFile(resolved); if (binary(buffer)) continue; findings.push(...scanPublicText({ policy, surface: config.surface, source: relative.replaceAll("\\", "/"), text: buffer.toString("utf8") })); }
  return findings;
}
