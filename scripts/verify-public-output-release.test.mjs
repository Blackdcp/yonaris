import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { scanPaths } from "./lib/public-output-policy.mjs";

const exec = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierScript = path.join(repositoryRoot, "scripts", "verify-public-output-release.mjs");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fixedNow = new Date("2030-01-01T00:00:00.000Z");
const fixturePhrase = "neutral signal zx9";
let releaseVerifierPromise;

function fixturePolicy() {
  return {
    policyVersion: 1,
    normalizationVersion: 1,
    ownerRole: "release-owner",
    surfaceClasses: ["portal"],
    fingerprints: [
      {
        id: "fixture_01",
        sha256: sha256(fixturePhrase),
        compactSha256: sha256(fixturePhrase.replaceAll(" ", "")),
        characters: fixturePhrase.length,
        tokens: 3,
        severity: "block",
      },
    ],
  };
}

function fixtureInventory(surfaceClass) {
  const phase = (name) => ({
    surface: `${surfaceClass}-${name}`,
    allowedRoots: ["."],
    include: ["."],
    exclude: [],
    binaryStrategy: "strings",
  });
  return {
    surfaceClass,
    phases: {
      source: phase("source"),
      artifact: phase("artifact"),
      "image-root": phase("image"),
    },
    runtimeRouteClasses: ["public"],
  };
}

function validException(overrides = {}) {
  return {
    fingerprintId: "fixture_01",
    exactPathSha256: sha256("neutral/source.txt"),
    legalBasisReference: "neutral-reference",
    approvedByRole: "release-owner",
    approvedAt: "2029-01-01T00:00:00.000Z",
    expiresAt: "2031-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function validRouteProbes() {
  return Array.from({ length: 26 }, (_, index) => ({
    id: `retired_route_${String(index + 1).padStart(2, "0")}`,
    path: `/neutral-route-${String(index + 1).padStart(2, "0")}`,
    expectedStatus: index % 2 === 0 ? 404 : 410,
  }));
}

async function writeJson(file, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  await writeFile(file, bytes);
  return bytes;
}

async function releaseFixture(t) {
  const base = await mkdtemp(path.join(tmpdir(), "release-verifier-fixture-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repo = path.join(base, "repo");
  const protectedRoot = path.join(base, "protected");
  const security = path.join(repo, "security");
  await mkdir(security, { recursive: true });
  await mkdir(protectedRoot);
  await exec("git", ["init", "--quiet", repo]);
  for (const name of [
    "public-output-policy.schema.json",
    "public-output-surfaces.schema.json",
    "public-output-release-manifest.schema.json",
    "private-output-exceptions.schema.json",
    "private-retired-route-probes.schema.json",
  ]) {
    await cp(path.join(repositoryRoot, "security", name), path.join(security, name));
  }

  const publicValues = {
    "security/public-output-policy.v1.json": fixturePolicy(),
    "security/public-output-surfaces.portal.v1.json": fixtureInventory("portal"),
  };
  for (const [relative, value] of Object.entries(publicValues)) {
    await writeJson(path.join(repo, ...relative.split("/")), value);
  }

  async function refreshManifest(overrides = {}) {
    const publicFiles = {};
    for (const relative of Object.keys(publicValues)) {
      publicFiles[relative] = sha256(await readFile(path.join(repo, ...relative.split("/"))));
    }
    await writeJson(path.join(security, "public-output-release-manifest.v1.json"), {
      manifestVersion: 1,
      ownerRole: "release-owner",
      publicFiles,
      ...overrides,
    });
    return publicFiles;
  }
  await refreshManifest();

  return {
    base,
    protectedRoot,
    repo,
    security,
    publicValues,
    refreshManifest,
    async writeProtected(name, value, raw = false) {
      const file = path.join(protectedRoot, name);
      const bytes = raw ? Buffer.from(value) : await writeJson(file, value);
      if (raw) await writeFile(file, bytes);
      return { digest: sha256(bytes), file };
    },
  };
}

async function verifyFixture(fixture, env = {}) {
  releaseVerifierPromise ??= import("./verify-public-output-release.mjs");
  const releaseVerifier = await releaseVerifierPromise;
  return releaseVerifier.verifyPublicOutputRelease({
    repositoryRoot: fixture.repo,
    env,
    now: fixedNow,
  });
}

function protectedEnv({ attestationFile, exceptions, routes } = {}) {
  return {
    ...(exceptions
      ? {
          YONARIS_OUTPUT_EXCEPTION_FILE: exceptions.file,
          YONARIS_OUTPUT_EXCEPTION_SHA256: exceptions.digest,
        }
      : {}),
    ...(routes
      ? {
          YONARIS_RETIRED_ROUTE_PROBE_FILE: routes.file,
          YONARIS_RETIRED_ROUTE_PROBE_SHA256: routes.digest,
        }
      : {}),
    ...(attestationFile ? { YONARIS_RELEASE_ATTESTATION_FILE: attestationFile } : {}),
  };
}

async function scannerFixture(t, phase, files) {
  const base = await mkdtemp(path.join(tmpdir(), "release-scanner-fixture-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = path.join(base, "config");
  const root = path.join(base, "scan-root");
  await mkdir(config);
  await mkdir(root);
  if (phase === "source") await exec("git", ["init", "--quiet", root]);
  const policyPath = path.join(config, "public-output-policy.v1.json");
  const inventoryPath = path.join(config, "public-output-surfaces.fixture.v1.json");
  await writeJson(policyPath, fixturePolicy());
  await writeJson(inventoryPath, fixtureInventory("portal"));
  await cp(
    path.join(repositoryRoot, "security", "public-output-policy.schema.json"),
    path.join(config, "public-output-policy.schema.json"),
  );
  await cp(
    path.join(repositoryRoot, "security", "public-output-surfaces.schema.json"),
    path.join(config, "public-output-surfaces.schema.json"),
  );
  const bytes = new Map();
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    const value = Buffer.from(content);
    await writeFile(target, value);
    bytes.set(relative, value);
  }
  return { bytes, inventoryPath, policyPath, root };
}

async function runVerifier(env) {
  try {
    const result = await exec(process.execPath, [verifierScript], {
      cwd: repositoryRoot,
      env: { ...process.env, ...env },
    });
    return { ...result, status: 0 };
  } catch (error) {
    return {
      status: error.code,
      stderr: error.stderr ?? "",
      stdout: error.stdout ?? "",
    };
  }
}

test("fails closed with a redacted code when protected exception dates are invalid", async (t) => {
  const protectedRoot = await mkdtemp(path.join(tmpdir(), "release-verifier-"));
  t.after(() => rm(protectedRoot, { recursive: true, force: true }));
  const exceptionFile = path.join(protectedRoot, "exceptions.json");
  const bytes = Buffer.from(
    `${JSON.stringify([
      {
        fingerprintId: "fixture_01",
        exactPathSha256: sha256("neutral/source.txt"),
        legalBasisReference: "neutral-reference",
        approvedByRole: "release-owner",
        approvedAt: "not-a-date",
        expiresAt: "also-not-a-date",
      },
    ])}\n`,
  );
  await writeFile(exceptionFile, bytes);

  const result = await runVerifier({
    YONARIS_OUTPUT_EXCEPTION_FILE: exceptionFile,
    YONARIS_OUTPUT_EXCEPTION_SHA256: sha256(bytes),
    YONARIS_RELEASE_ATTESTATION_FILE: "",
    YONARIS_RETIRED_ROUTE_PROBE_FILE: "",
    YONARIS_RETIRED_ROUTE_PROBE_SHA256: "",
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "PUBLIC_OUTPUT_EXCEPTION_INVALID\n");
  assert.equal(result.stdout, "");
});

test("executes every tracked schema in Ajv strict mode before digest checks", async (t) => {
  const cases = [
    {
      expected: "PUBLIC_OUTPUT_SCHEMA_INVALID",
      mutate: async (fixture) => {
        await writeJson(path.join(fixture.security, "private-output-exceptions.schema.json"), {
          type: "array",
          unknownStrictKeyword: true,
        });
      },
    },
    {
      expected: "PUBLIC_OUTPUT_MANIFEST_INVALID",
      mutate: async (fixture) => {
        await writeFile(path.join(fixture.security, "public-output-release-manifest.v1.json"), "{");
      },
    },
    {
      expected: "PUBLIC_OUTPUT_MANIFEST_INVALID",
      mutate: async (fixture) => {
        const publicFiles = await fixture.refreshManifest();
        await writeJson(path.join(fixture.security, "public-output-release-manifest.v1.json"), {
          manifestVersion: 1,
          ownerRole: "release-owner",
          publicFiles,
          unexpected: true,
        });
      },
    },
    {
      expected: "PUBLIC_OUTPUT_POLICY_INVALID",
      mutate: async (fixture) => {
        await writeJson(path.join(fixture.security, "public-output-policy.v1.json"), {
          ...fixturePolicy(),
          unexpected: true,
        });
      },
    },
    {
      expected: "PUBLIC_OUTPUT_POLICY_INVALID",
      mutate: async (fixture) => {
        const policy = fixturePolicy();
        policy.policyVersion = "1";
        await writeJson(path.join(fixture.security, "public-output-policy.v1.json"), policy);
      },
    },
    {
      expected: "PUBLIC_OUTPUT_POLICY_INVALID",
      mutate: async (fixture) => {
        const policy = fixturePolicy();
        policy.fingerprints.push({ ...policy.fingerprints[0], sha256: sha256("other neutral signal") });
        await writeJson(path.join(fixture.security, "public-output-policy.v1.json"), policy);
      },
    },
    {
      expected: "PUBLIC_OUTPUT_INVENTORY_INVALID",
      mutate: async (fixture) => {
        await writeJson(path.join(fixture.security, "public-output-surfaces.portal.v1.json"), {
          ...fixtureInventory("portal"),
          unexpected: true,
        });
      },
    },
  ];

  for (const [index, fixtureCase] of cases.entries()) {
    await t.test(`strict schema rejection ${index + 1}`, async (subtest) => {
      const fixture = await releaseFixture(subtest);
      await fixtureCase.mutate(fixture);
      await assert.rejects(verifyFixture(fixture), { message: fixtureCase.expected });
    });
  }
});

test("validates all public digests before protected input boundaries", async (t) => {
  const fixture = await releaseFixture(t);
  const manifestFile = path.join(fixture.security, "public-output-release-manifest.v1.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  manifest.publicFiles["security/public-output-policy.v1.json"] = "0".repeat(64);
  await writeJson(manifestFile, manifest);

  await assert.rejects(
    verifyFixture(fixture, { YONARIS_OUTPUT_EXCEPTION_FILE: path.join(fixture.repo, "missing.json") }),
    { message: "PUBLIC_OUTPUT_PUBLIC_DIGEST_MISMATCH" },
  );
});

test("rejects incomplete, unsafe, and unverified protected file boundaries before parsing", async (t) => {
  const fixture = await releaseFixture(t);
  const valid = await fixture.writeProtected("valid.json", [validException()]);

  await assert.rejects(
    verifyFixture(fixture, { YONARIS_OUTPUT_EXCEPTION_FILE: valid.file }),
    { message: "PUBLIC_OUTPUT_PROTECTED_PAIR_INVALID" },
  );
  await assert.rejects(
    verifyFixture(fixture, { YONARIS_OUTPUT_EXCEPTION_SHA256: valid.digest }),
    { message: "PUBLIC_OUTPUT_PROTECTED_PAIR_INVALID" },
  );
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: path.join(fixture.protectedRoot, "missing.json"),
      YONARIS_OUTPUT_EXCEPTION_SHA256: valid.digest,
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID" },
  );

  const insideFile = path.join(fixture.security, "inside.json");
  const insideBytes = await writeJson(insideFile, [validException()]);
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: insideFile,
      YONARIS_OUTPUT_EXCEPTION_SHA256: sha256(insideBytes),
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID" },
  );

  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: fixture.protectedRoot,
      YONARIS_OUTPUT_EXCEPTION_SHA256: valid.digest,
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID" },
  );

  const link = path.join(fixture.protectedRoot, "exceptions-link.json");
  await symlink(valid.file, link, "file");
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: link,
      YONARIS_OUTPUT_EXCEPTION_SHA256: valid.digest,
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_BOUNDARY_INVALID" },
  );

  const invalidJson = await fixture.writeProtected("invalid.json", "{", true);
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: invalidJson.file,
      YONARIS_OUTPUT_EXCEPTION_SHA256: "0".repeat(64),
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_DIGEST_MISMATCH" },
  );
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_OUTPUT_EXCEPTION_FILE: invalidJson.file,
      YONARIS_OUTPUT_EXCEPTION_SHA256: invalidJson.digest.toUpperCase(),
    }),
    { message: "PUBLIC_OUTPUT_PROTECTED_DIGEST_INVALID" },
  );
});

test("rejects invalid, unknown, expired, targetless, and ambiguous exceptions", async (t) => {
  const fixture = await releaseFixture(t);
  const invalidCases = [
    [{ ...validException(), unexpected: true }],
    [{ ...validException(), legalBasisReference: "" }],
    [{ ...validException(), approvedByRole: "policy-editor" }],
    [{ ...validException(), approvedAt: "not-a-date" }],
    [{ ...validException(), expiresAt: "not-a-date" }],
    [{ ...validException(), expiresAt: "2029-12-31T23:59:59.000Z" }],
    [{ ...validException(), approvedAt: "2030-01-02T00:00:00.000Z" }],
    [{ ...validException(), fingerprintId: "fixture_unknown" }],
    [{ ...validException(), exactPathSha256: "A".repeat(64) }],
    [
      (() => {
        const value = validException();
        delete value.exactPathSha256;
        return value;
      })(),
    ],
    [validException(), validException()],
    [
      validException({ artifactSha256: sha256("first bytes") }),
      validException({ artifactSha256: sha256("second bytes") }),
    ],
  ];

  for (const value of invalidCases) {
    const exceptions = await fixture.writeProtected("exceptions.json", value);
    await assert.rejects(verifyFixture(fixture, protectedEnv({ exceptions })), {
      message: "PUBLIC_OUTPUT_EXCEPTION_INVALID",
    });
  }

  const malformed = await fixture.writeProtected("exceptions.json", "{", true);
  await assert.rejects(verifyFixture(fixture, protectedEnv({ exceptions: malformed })), {
    message: "PUBLIC_OUTPUT_EXCEPTION_INVALID",
  });
});

test("requires exactly 26 opaque safe unique retired route probes", async (t) => {
  const fixture = await releaseFixture(t);
  const mutations = [
    (value) => value.slice(0, 25),
    (value) => [...value, { ...value[25] }],
    (value) => {
      value[0].path = "https://example.invalid/neutral";
      return value;
    },
    (value) => {
      value[0].path = "//example.invalid/neutral";
      return value;
    },
    (value) => {
      value[0].path = "/neutral?query=true";
      return value;
    },
    (value) => {
      value[0].path = "/neutral#fragment";
      return value;
    },
    (value) => {
      value[0].path = "/neutral/../route";
      return value;
    },
    (value) => {
      value[0].path = "/neutral/%2e%2e/route";
      return value;
    },
    (value) => {
      value[0].path = "/neutral/%252e%252e/route";
      return value;
    },
    (value) => {
      value[0].path = "/neutral/\u0001route";
      return value;
    },
    (value) => {
      value[1].path = value[0].path;
      return value;
    },
    (value) => {
      value[1].id = value[0].id;
      return value;
    },
    (value) => {
      delete value[0].id;
      return value;
    },
    (value) => {
      value[0].expectedStatus = 200;
      return value;
    },
    (value) => {
      value[0].unexpected = true;
      return value;
    },
  ];

  for (const mutate of mutations) {
    const routes = await fixture.writeProtected("routes.json", mutate(validRouteProbes()));
    await assert.rejects(verifyFixture(fixture, protectedEnv({ routes })), {
      message: "PUBLIC_OUTPUT_ROUTE_PROBE_INVALID",
    });
  }

  const malformed = await fixture.writeProtected("routes.json", "{", true);
  await assert.rejects(verifyFixture(fixture, protectedEnv({ routes: malformed })), {
    message: "PUBLIC_OUTPUT_ROUTE_PROBE_INVALID",
  });
});

test("binds source exceptions to the exact path or exact bytes only", async (t) => {
  await t.test("a path target suppresses only its exact POSIX root-relative source", async (subtest) => {
    const fixture = await scannerFixture(subtest, "source", {
      "neutral/one.txt": `${fixturePhrase}\n`,
      "neutral/two.txt": `${fixturePhrase}\n`,
    });
    const findings = await scanPaths({
      policyPath: fixture.policyPath,
      inventoryPath: fixture.inventoryPath,
      phase: "source",
      root: fixture.root,
      exceptions: [validException({ exactPathSha256: sha256("neutral/one.txt") })],
      now: fixedNow,
    });
    assert.deepEqual(findings.map((finding) => finding.source), ["neutral/two.txt"]);
  });

  await t.test("an artifact target suppresses exact current source bytes", async (subtest) => {
    const fixture = await scannerFixture(subtest, "source", {
      "neutral/source.txt": `${fixturePhrase}\n`,
    });
    const exception = validException({
      artifactSha256: sha256(fixture.bytes.get("neutral/source.txt")),
    });
    delete exception.exactPathSha256;
    const findings = await scanPaths({
      policyPath: fixture.policyPath,
      inventoryPath: fixture.inventoryPath,
      phase: "source",
      root: fixture.root,
      exceptions: [exception],
      now: fixedNow,
    });
    assert.deepEqual(findings, []);
  });

  await t.test("an artifact target does not suppress changed source bytes", async (subtest) => {
    const fixture = await scannerFixture(subtest, "source", {
      "neutral/source.txt": `${fixturePhrase} changed\n`,
    });
    const exception = validException({ artifactSha256: sha256(`${fixturePhrase}\n`) });
    delete exception.exactPathSha256;
    const findings = await scanPaths({
      policyPath: fixture.policyPath,
      inventoryPath: fixture.inventoryPath,
      phase: "source",
      root: fixture.root,
      exceptions: [exception],
      now: fixedNow,
    });
    assert.deepEqual(findings.map((finding) => finding.source), ["neutral/source.txt"]);
  });
});

test("never suppresses artifact or image-root findings", async (t) => {
  for (const phase of ["artifact", "image-root"]) {
    await t.test(phase, async (subtest) => {
      const fixture = await scannerFixture(subtest, phase, {
        "neutral/source.txt": `${fixturePhrase}\n`,
      });
      const findings = await scanPaths({
        policyPath: fixture.policyPath,
        inventoryPath: fixture.inventoryPath,
        phase,
        root: fixture.root,
        exceptions: [
          validException({
            exactPathSha256: sha256("neutral/source.txt"),
            artifactSha256: sha256(fixture.bytes.get("neutral/source.txt")),
          }),
        ],
        now: fixedNow,
      });
      assert.deepEqual(findings.map((finding) => finding.source), ["neutral/source.txt"]);
    });
  }
});

test("rejects expired source exceptions instead of applying them", async (t) => {
  const fixture = await scannerFixture(t, "source", {
    "neutral/source.txt": `${fixturePhrase}\n`,
  });
  await assert.rejects(
    scanPaths({
      policyPath: fixture.policyPath,
      inventoryPath: fixture.inventoryPath,
      phase: "source",
      root: fixture.root,
      exceptions: [validException({ expiresAt: "2029-12-31T23:59:59.000Z" })],
      now: fixedNow,
    }),
    { message: "PUBLIC_OUTPUT_EXCEPTION_INVALID" },
  );
});

test("writes only verified digests, role, and UTC time to a safe external attestation", async (t) => {
  const fixture = await releaseFixture(t);
  const exceptions = await fixture.writeProtected("exceptions.json", [validException()]);
  const routes = await fixture.writeProtected("routes.json", validRouteProbes());
  const attestationFile = path.join(fixture.protectedRoot, "attestation.json");
  const publicFiles = await fixture.refreshManifest();

  await verifyFixture(fixture, protectedEnv({ attestationFile, exceptions, routes }));

  const raw = await readFile(attestationFile, "utf8");
  const attestation = JSON.parse(raw);
  assert.deepEqual(attestation, {
    policyDigest: publicFiles["security/public-output-policy.v1.json"],
    portalInventoryDigest: publicFiles["security/public-output-surfaces.portal.v1.json"],
    retiredRouteProbeDigest: routes.digest,
    legalExceptionDigest: exceptions.digest,
    ownerRole: "release-owner",
    verifiedAt: fixedNow.toISOString(),
  });
  assert.equal(raw.includes("neutral-route"), false);
  assert.equal(raw.includes("fixture_01"), false);
  assert.equal(raw.includes(exceptions.file), false);
  if (process.platform !== "win32") {
    assert.equal((await stat(attestationFile)).mode & 0o777, 0o600);
  } else {
    assert.equal((await stat(attestationFile)).isFile(), true);
  }
});

test("rejects attestation targets inside the repository or through symlinks", async (t) => {
  const fixture = await releaseFixture(t);
  await assert.rejects(
    verifyFixture(fixture, {
      YONARIS_RELEASE_ATTESTATION_FILE: path.join(fixture.repo, "attestation.json"),
    }),
    { message: "PUBLIC_OUTPUT_ATTESTATION_INVALID" },
  );

  const target = path.join(fixture.protectedRoot, "target.json");
  await writeFile(target, "{}\n");
  const link = path.join(fixture.protectedRoot, "attestation-link.json");
  await symlink(target, link, "file");
  await assert.rejects(
    verifyFixture(fixture, { YONARIS_RELEASE_ATTESTATION_FILE: link }),
    { message: "PUBLIC_OUTPUT_ATTESTATION_INVALID" },
  );
});
