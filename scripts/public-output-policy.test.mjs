import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizePublicText,
  scanPublicText,
  tokenizePublicText,
} from "./lib/public-output-policy.mjs";

function fixturePolicy() {
  const phrase = ["fixture", "signal", "zx9"].join(" ");
  const normalized = normalizeForFixture(phrase);
  return {
    phrase,
    fingerprints: [
      {
        id: "fixture_01",
        sha256: createHash("sha256").update(normalized).digest("hex"),
        characters: normalized.length,
        tokens: normalized.split(" ").length,
        severity: "block",
      },
    ],
  };
}

function normalizeForFixture(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

test("normalizes neutral public text before scanning", () => {
  const policy = fixturePolicy();
  assert.equal(normalizePublicText("Ｆｉｘｔｕｒｅ\u200b SIGNAL\tZX9"), policy.phrase);
  assert.deepEqual(tokenizePublicText("fixture/signal_zx9"), ["fixture", "signal", "zx9"]);
  assert.equal(normalizePublicText("fixture\\u0020signal&#32;zx9"), policy.phrase);
});

test("reports deterministic redacted findings for an encoded neutral fixture", () => {
  const policy = fixturePolicy();
  const input = {
    policy,
    surface: "marketing-source",
    source: "fixture.html",
    text: "prefix fixture&#32;signal%20zx9 suffix",
  };
  const findings = scanPublicText(input);

  assert.deepEqual(findings, [
    {
      id: "fixture_01",
      severity: "block",
      surface: "marketing-source",
      source: "fixture.html",
      offset: 7,
    },
  ]);
  assert.equal(JSON.stringify(findings).includes(policy.phrase), false);
});

test("does not block a safe neutral substring", () => {
  const policy = fixturePolicy();
  assert.deepEqual(scanPublicText({ policy, surface: "fixture", source: "safe.txt", text: "signal zx9 only" }), []);
});

test("requires the release-owner role for the public manifest contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("../security/public-output-release-manifest.v1.json", import.meta.url)));
  assert.equal(manifest.ownerRole, "release-owner");
  assert.notEqual(manifest.ownerRole, "policy-editor");
});
