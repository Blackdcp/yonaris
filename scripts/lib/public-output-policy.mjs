import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const HTML_ENTITY = /&#(?:x([0-9a-f]+)|([0-9]+));?/gi;
const JS_ESCAPE = /\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2}))/gi;
const SEPARATORS = /[\/_\-\s]+/g;

function decode(value) {
  return value
    .replace(HTML_ENTITY, (_, hex, decimal) => String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/%(?:[0-9a-f]{2})+/gi, (encoded) => {
      try { return decodeURIComponent(encoded); } catch { return encoded; }
    })
    .replace(JS_ESCAPE, (_, codePoint, unicode, hex) => String.fromCodePoint(Number.parseInt(codePoint || unicode || hex, codePoint || unicode ? 16 : 16)));
}

export function normalizePublicText(value) {
  return decode(String(value)).normalize("NFKC").toLowerCase().replace(ZERO_WIDTH, "").replace(SEPARATORS, " ").trim();
}

export function tokenizePublicText(value) {
  return normalizePublicText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const digest = (value) => createHash("sha256").update(value).digest("hex");

export function scanPublicText({ policy, surface, source, text }) {
  const normalized = normalizePublicText(text);
  const tokens = tokenizePublicText(normalized);
  const findings = [];
  for (const fingerprint of policy.fingerprints) {
    const candidates = new Set();
    for (let index = 0; index + fingerprint.tokens <= tokens.length; index += 1) {
      candidates.add(tokens.slice(index, index + fingerprint.tokens).join(" "));
    }
    for (let index = 0; index + fingerprint.characters <= normalized.length; index += 1) {
      candidates.add(normalized.slice(index, index + fingerprint.characters));
    }
    if ([...candidates].some((candidate) => digest(candidate) === fingerprint.sha256)) {
      const tokenCandidate = [...candidates].find((candidate) => digest(candidate) === fingerprint.sha256) ?? "";
      findings.push({ id: fingerprint.id, severity: "block", surface, source, offset: Math.max(0, normalized.indexOf(tokenCandidate)) });
    }
  }
  return findings.sort((left, right) => left.id.localeCompare(right.id) || left.source.localeCompare(right.source) || left.offset - right.offset);
}

async function filesAt(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesAt(target) : [target];
  }));
  return paths.flat();
}

export async function scanPaths({ policyPath, inventoryPath, phase, root }) {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const configured = inventory.phases?.[phase];
  if (!configured) throw new Error(`Unsupported public-output phase: ${phase}`);
  const rootStats = await stat(root);
  const paths = rootStats.isDirectory() ? await filesAt(root) : [root];
  const findings = [];
  for (const target of paths) {
    const text = await readFile(target, "utf8");
    findings.push(...scanPublicText({ policy, surface: configured.surface, source: path.relative(root, target) || path.basename(target), text }));
  }
  return findings;
}
