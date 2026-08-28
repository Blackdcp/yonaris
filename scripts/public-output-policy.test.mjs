import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv from "ajv";

import * as publicOutputPolicy from "./lib/public-output-policy.mjs";

const { normalizePublicText, scanPaths, scanPublicText, tokenizePublicText } = publicOutputPolicy;

const exec = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditScript = path.join(repositoryRoot, "scripts", "public-output-audit.mjs");
const fixturePhrase = "fixture signal zx9";

function fixturePolicy() {
  return {
    policyVersion: 1,
    normalizationVersion: 1,
    ownerRole: "release-owner",
    surfaceClasses: ["marketing", "portal"],
    fingerprints: [
      {
        id: "fixture_01",
        sha256: createHash("sha256").update(fixturePhrase).digest("hex"),
        compactSha256: createHash("sha256").update(fixturePhrase.replaceAll(" ", "")).digest("hex"),
        characters: fixturePhrase.length,
        tokens: 3,
        severity: "block",
      },
    ],
  };
}

function inventory(phase, overrides = {}) {
  const phaseConfig = (name) => ({
    surface: `marketing-${name}`,
    allowedRoots: ["."],
    include: ["."],
    exclude: [],
    binaryStrategy: "strings",
    ...(name === phase ? overrides : {}),
  });
  return {
    surfaceClass: "marketing",
    phases: {
      source: phaseConfig("source"),
      artifact: phaseConfig("artifact"),
      "image-root": phaseConfig("image-root"),
    },
    runtimeRouteClasses: ["public"],
  };
}

async function fixtureWorkspace(t) {
  const base = await mkdtemp(path.join(tmpdir(), "public-output-policy-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = path.join(base, "config");
  await mkdir(config);
  const policyPath = path.join(config, "public-output-policy.v1.json");
  const inventoryPath = path.join(config, "public-output-surfaces.fixture.v1.json");
  await writeFile(policyPath, `${JSON.stringify(fixturePolicy())}\n`);
  await cp(
    path.join(repositoryRoot, "security", "public-output-policy.schema.json"),
    path.join(config, "public-output-policy.schema.json"),
  );
  await cp(
    path.join(repositoryRoot, "security", "public-output-surfaces.schema.json"),
    path.join(config, "public-output-surfaces.schema.json"),
  );
  return {
    base,
    inventoryPath,
    policyPath,
    async writeInventory(value) {
      await writeFile(inventoryPath, `${JSON.stringify(value)}\n`);
    },
  };
}

async function fixtureAuditRepository(t) {
  const root = await mkdtemp(path.join(repositoryRoot, ".public-output-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(root, "security"), { recursive: true });
  for (const relative of [
    "scripts/public-output-audit.mjs",
    "scripts/lib/public-output-policy.mjs",
    "security/public-output-policy.v1.json",
    "security/public-output-policy.schema.json",
    "security/public-output-surfaces.schema.json",
    "security/public-output-surfaces.marketing.v1.json",
    "security/public-output-surfaces.portal.v1.json",
  ]) {
    await cp(path.join(repositoryRoot, relative), path.join(root, relative));
  }
  await writeFile(path.join(root, "neutral.txt"), "completely neutral\n");
  await initGit(root);
  return {
    auditScript: path.join(root, "scripts", "public-output-audit.mjs"),
    nestedCwd: path.join(root, "scripts", "lib"),
    root,
  };
}

async function initGit(root) {
  await mkdir(root, { recursive: true });
  await exec("git", ["init", "--quiet", root]);
}

async function runAudit(args, options = {}) {
  const { auditScriptPath = auditScript, ...execOptions } = options;
  try {
    const result = await exec(process.execPath, [auditScriptPath, ...args], {
      cwd: repositoryRoot,
      ...execOptions,
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

test("repository topology excludes retired distribution surfaces and preserves legal notices", async () => {
  const { stdout } = await exec("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const trackedFiles = stdout.split("\0").filter(Boolean).sort();
  const tracked = new Set(trackedFiles);
  const blockers = [];

  const forbiddenPrefixes = [
    ".github/blog-agent/",
    "apps/cli/",
    "apps/www/.source/",
    "packages/docs/",
  ];
  const forbiddenFiles = [
    ".github/FUNDING.yml",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/contributors.txt",
    ".github/workflows/claude.yml",
    "CLA.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "CONTRIBUTORS.md",
    "SECURITY.md",
    "apps/www/source.config.ts",
    "apps/www/source.generated.ts",
    "apps/www/src/components/answer-presence-software-hub.tsx",
    "apps/www/src/components/api-page.tsx",
    "apps/www/src/components/mdx.tsx",
    "apps/www/src/components/youtube-embed.tsx",
    "apps/www/src/lib/blog.ts",
    "apps/www/src/lib/release-markdown.tsx",
    "apps/www/src/styles/pages/publication.css",
    "e2e/cli-driver.ts",
    "scripts/generate-release-notes.mjs",
    "scripts/sync-root-version.mjs",
  ];
  for (const file of forbiddenFiles) {
    if (tracked.has(file)) blockers.push(`tracked:${file}`);
  }
  for (const prefix of forbiddenPrefixes) {
    if (trackedFiles.some((file) => file.startsWith(prefix))) blockers.push(`tracked-prefix:${prefix}`);
  }

  const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const forbiddenRootScripts = new Set(["cli:link", "cli:unlink", "release"]);
  const forbiddenRootScriptValue =
    /(?:apps\/cli|npm\s+(?:un)?link|changeset\s+publish|generate-release-notes|sync-root-version)/u;
  for (const [name, command] of Object.entries(rootPackage.scripts ?? {})) {
    if (forbiddenRootScripts.has(name) || forbiddenRootScriptValue.test(command)) {
      blockers.push(`root-script:${name}`);
    }
  }

  const wwwPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, "apps", "www", "package.json"), "utf8"),
  );
  const retiredDependency =
    /^(?:@mdx-js\/|@tailwindcss\/typography$|@types\/mdx$|@workspace\/(?:api-spec|docs)$|fumadocs|react-markdown$|remark-gfm$|shiki$)/u;
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const name of Object.keys(wwwPackage[section] ?? {})) {
      if (retiredDependency.test(name)) blockers.push(`www-${section}:${name}`);
    }
  }
  const wwwTsconfig = JSON.parse(
    await readFile(path.join(repositoryRoot, "apps", "www", "tsconfig.json"), "utf8"),
  );
  for (const include of wwwTsconfig.include ?? []) {
    if (typeof include === "string" && include.startsWith("content/")) {
      blockers.push(`www-tsconfig-orphan:${include}`);
    }
  }

  const workspacePackageNames = new Set();
  for (const file of trackedFiles.filter(
    (file) => file === "package.json" || file.endsWith("/package.json"),
  )) {
    const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, file), "utf8"));
    if (typeof packageJson.name === "string") workspacePackageNames.add(packageJson.name);
  }
  for (const file of trackedFiles.filter(
    (file) => file.startsWith(".changeset/") || file === ".claude/skills/add-changeset/SKILL.md",
  )) {
    const content = await readFile(path.join(repositoryRoot, file), "utf8");
    const referencedPackages = [...content.matchAll(/^"([^"]+)":\s*(?:patch|minor|major)$/gmu)].map(
      (match) => match[1],
    );
    if (referencedPackages.some((name) => !workspacePackageNames.has(name))) {
      blockers.push(`unknown-package-reference:${file}`);
    }
  }

  const operationalFiles = trackedFiles.filter(
    (file) =>
      file === ".dockerignore" ||
      file === "knip.json" ||
      file === "package.json" ||
      file === "pnpm-workspace.yaml" ||
      file.startsWith(".changeset/") ||
      file.startsWith(".github/workflows/") ||
      file.startsWith("apps/www/src/") ||
      /^apps\/www\/(?:package\.json|[^/]*config\.(?:js|json|ts)|tsconfig[^/]*\.json)$/u.test(file) ||
      file.startsWith("docker/") ||
      file.startsWith("e2e/"),
  );
  for (const file of ["apps/www/package.json", "apps/www/tsconfig.json", "apps/www/vite.config.ts"]) {
    if (!operationalFiles.includes(file)) blockers.push(`unscanned-operational-config:${file}`);
  }
  const retiredOperationalReference =
    /(?:packages[\\/]docs|apps[\\/]cli|@workspace\/docs|source\.generated|fumadocs|@mdx-js\/rollup)/u;
  for (const file of operationalFiles) {
    const content = await readFile(path.join(repositoryRoot, file), "utf8");
    if (retiredOperationalReference.test(content)) blockers.push(`operational-reference:${file}`);
  }

  if (!tracked.has("LICENSE.md")) blockers.push("missing:LICENSE.md");
  if (!tracked.has("scripts/check-licenses.mjs")) blockers.push("missing:scripts/check-licenses.mjs");
  if (!trackedFiles.some((file) => /third[-_ ]party.*(?:license|notice)/iu.test(file))) {
    blockers.push("missing:third-party-notice");
  }

  assert.deepEqual(blockers.sort(), []);
});

test("allows the approved Yonaris category in public output", async () => {
  const policy = JSON.parse(
    await readFile(path.join(repositoryRoot, "security", "public-output-policy.v1.json"), "utf8"),
  );

  assert.deepEqual(
    scanPublicText({
      policy,
      surface: "marketing-source",
      source: "approved-category.txt",
      text: "AI-native MarTech infrastructure built for decisions made by people and shaped by agents",
    }),
    [],
  );
});

test("normalizes named entities and slash, underscore, and hyphen separators", () => {
  for (const value of [
    "fixture&Tab;signal&NewLine;zx9",
    "fixture&nbsp;signal&nbsp;zx9",
    "fixture/signal/zx9",
    "fixture_signal_zx9",
    "fixture-signal-zx9",
  ]) {
    assert.equal(normalizePublicText(value), "fixture signal zx9", value);
  }
});

test("matches named slash, lowbar, and hyphen entity separators", () => {
  for (const text of [
    "fixture&sol;signal&sol;zx9",
    "fixture&lowbar;signal&lowbar;zx9",
    "fixture&hyphen;signal&hyphen;zx9",
  ]) {
    assert.equal(
      scanPublicText({ policy: fixturePolicy(), surface: "fixture", source: "entity.txt", text }).length,
      1,
      text,
    );
  }
});

test("recursively normalizes double percent, HTML, and JavaScript encodings", () => {
  for (const value of [
    "fixture%2520signal%2520zx9",
    "fixture&amp;#32;signal&amp;#32;zx9",
    "fixture\\u005cu0020signal\\u005cu0020zx9",
  ]) {
    assert.equal(normalizePublicText(value), "fixture signal zx9", value);
  }
});

test("normalizes five-plus recursive percent encodings", () => {
  assert.equal(
    normalizePublicText("fixture%252525252520signal%252525252520zx9"),
    fixturePhrase,
  );
});

test("rejects exhausted decode rounds and oversized normalization input with a redacted code", () => {
  let tooDeep = "%20";
  for (let index = 0; index < 17; index += 1) tooDeep = encodeURIComponent(tooDeep);
  assert.throws(() => normalizePublicText(`fixture${tooDeep}signal`), {
    message: "PUBLIC_OUTPUT_NORMALIZATION_LIMIT",
  });
  assert.throws(() => normalizePublicText("x".repeat(1_048_577)), {
    message: "PUBLIC_OUTPUT_NORMALIZATION_LIMIT",
  });
});

test("tokenizes the neutral separated fixture", () => {
  assert.deepEqual(tokenizePublicText("fixture/signal_zx9"), ["fixture", "signal", "zx9"]);
});

test("matches the fully compact neutral fixture", () => {
  assert.equal(
    scanPublicText({
      policy: fixturePolicy(),
      surface: "fixture",
      source: "compact.txt",
      text: "fixturesignalzx9",
    }).length,
    1,
  );
});

test("matches partially compact neutral fixture windows", () => {
  for (const text of ["fixturesignal zx9", "fixture signalzx9"]) {
    assert.equal(
      scanPublicText({ policy: fixturePolicy(), surface: "fixture", source: "partial.txt", text }).length,
      1,
      text,
    );
  }
});

test("matches a neutral fixture token split by an inserted separator", () => {
  assert.deepEqual(
    scanPublicText({
      policy: fixturePolicy(),
      surface: "fixture",
      source: "split-token.txt",
      text: "fix/ture signal zx9",
    }),
    [
      {
        id: "fixture_01",
        severity: "block",
        surface: "fixture",
        source: "split-token.txt",
        offset: 0,
      },
    ],
  );
});

test("matches a neutral fixture token split by many inserted separators", () => {
  assert.deepEqual(
    scanPublicText({
      policy: fixturePolicy(),
      surface: "fixture",
      source: "multi-split-token.txt",
      text: "fi/x/t/u/r/e signal zx9",
    }),
    [
      {
        id: "fixture_01",
        severity: "block",
        surface: "fixture",
        source: "multi-split-token.txt",
        offset: 0,
      },
    ],
  );
});

test("does not match compact tokens with safe prefixes or suffixes", () => {
  for (const text of ["safefixturesignalzx9", "fixturesignalzx9safe", "fixturesignalsafe zx9"]) {
    assert.deepEqual(
      scanPublicText({ policy: fixturePolicy(), surface: "fixture", source: "safe.txt", text }),
      [],
      text,
    );
  }
});

test("scans a large neutral source file within the release time budget", () => {
  const text = "alpha bravo charli ".repeat(27_778).slice(0, 500_000);
  const startedAt = performance.now();
  const findings = scanPublicText({
    policy: fixturePolicy(),
    surface: "fixture",
    source: "large-neutral.txt",
    text,
  });
  const elapsed = performance.now() - startedAt;

  assert.deepEqual(findings, []);
  assert.ok(elapsed <= 5_000, `expected <= 5000ms, received ${Math.round(elapsed)}ms`);
});

test("reports deterministic redacted findings", () => {
  const findings = scanPublicText({
    policy: fixturePolicy(),
    surface: "marketing-source",
    source: "fixture.html",
    text: "prefix fixture&#32;signal%20zx9 suffix",
  });
  assert.deepEqual(findings, [
    {
      id: "fixture_01",
      severity: "block",
      surface: "marketing-source",
      source: "fixture.html",
      offset: 7,
    },
  ]);
  assert.equal(JSON.stringify(findings).includes(fixturePhrase), false);
});

test("reports the offset of the matched repeated-token window", () => {
  assert.deepEqual(
    scanPublicText({
      policy: fixturePolicy(),
      surface: "fixture",
      source: "repeated.txt",
      text: "fixture safe fixture signal zx9",
    }),
    [
      {
        id: "fixture_01",
        severity: "block",
        surface: "fixture",
        source: "repeated.txt",
        offset: 13,
      },
    ],
  );
});

test("rejects unsafe policy sizes before scanning", () => {
  const policy = fixturePolicy();
  policy.fingerprints[0].characters = 257;
  assert.throws(() => scanPublicText({ policy, surface: "fixture", source: "safe.txt", text: "safe" }), {
    message: "PUBLIC_OUTPUT_POLICY_INVALID",
  });
});

test("requires a lowercase compact digest in every policy fingerprint", async () => {
  const schema = JSON.parse(
    await readFile(path.join(repositoryRoot, "security", "public-output-policy.schema.json"), "utf8"),
  );
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const valid = fixturePolicy();
  const missing = structuredClone(valid);
  delete missing.fingerprints[0].compactSha256;
  const malformed = structuredClone(valid);
  malformed.fingerprints[0].compactSha256 = "A".repeat(64);

  assert.equal(validate(valid), true, JSON.stringify(validate.errors));
  assert.equal(validate(missing), false);
  assert.equal(validate(malformed), false);
  for (const policy of [missing, malformed]) {
    assert.throws(
      () => scanPublicText({ policy, surface: "fixture", source: "safe.txt", text: "safe" }),
      { message: "PUBLIC_OUTPUT_POLICY_INVALID" },
    );
  }
});

test("loads and compiles the strict surface inventory schema for both inventories", async () => {
  const schema = JSON.parse(
    await readFile(path.join(repositoryRoot, "security", "public-output-surfaces.schema.json"), "utf8"),
  );
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  for (const name of ["marketing", "portal"]) {
    const value = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "security", `public-output-surfaces.${name}.v1.json`),
        "utf8",
      ),
    );
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
  }
});

test("rejects missing, extra, and wrong-type inventory fields", async () => {
  const schema = JSON.parse(
    await readFile(path.join(repositoryRoot, "security", "public-output-surfaces.schema.json"), "utf8"),
  );
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const valid = inventory("source");
  const invalid = [
    { ...valid, extra: true },
    { ...valid, phases: { ...valid.phases, source: { ...valid.phases.source, allowedRoots: undefined } } },
    { ...valid, phases: { ...valid.phases, source: { ...valid.phases.source, include: "./" } } },
    { ...valid, phases: { ...valid.phases, source: { ...valid.phases.source, exclude: false } } },
    { ...valid, phases: { ...valid.phases, source: { ...valid.phases.source, binaryStrategy: 1 } } },
    { ...valid, phases: { ...valid.phases, source: { ...valid.phases.source, extra: true } } },
  ];
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value));
});

test("source inventory scans only allowed tracked and untracked non-ignored files", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "repo");
  await initGit(root);
  await mkdir(path.join(root, "allowed", "excluded"), { recursive: true });
  await mkdir(path.join(root, "allowed", "ignored-dependency"), { recursive: true });
  await mkdir(path.join(root, ".superpowers"), { recursive: true });
  await mkdir(path.join(root, "node_modules"), { recursive: true });
  await mkdir(path.join(root, "disallowed"), { recursive: true });
  await writeFile(path.join(root, ".gitignore"), "allowed/ignored-dependency/\n");
  for (const relative of [
    "allowed/tracked.txt",
    "allowed/untracked.txt",
    "allowed/excluded/leak.txt",
    "allowed/ignored-dependency/leak.txt",
    ".superpowers/leak.txt",
    "node_modules/leak.txt",
    "disallowed/leak.txt",
  ]) {
    await writeFile(path.join(root, relative), "fixture signal zx9\n");
  }
  await exec("git", [
    "-C",
    root,
    "add",
    "-f",
    "allowed/tracked.txt",
    ".superpowers/leak.txt",
    "node_modules/leak.txt",
  ]);
  await fixture.writeInventory(
    inventory("source", {
      allowedRoots: ["allowed", ".superpowers", "node_modules"],
      exclude: ["allowed/excluded"],
    }),
  );

  const findings = await scanPaths({
    policyPath: fixture.policyPath,
    inventoryPath: fixture.inventoryPath,
    phase: "source",
    root,
  });
  assert.deepEqual(
    findings.map((finding) => finding.source),
    ["allowed/tracked.txt", "allowed/untracked.txt"],
  );
});

test("source requires an explicit root", async (t) => {
  const fixture = await fixtureWorkspace(t);
  await fixture.writeInventory(inventory("source"));
  await assert.rejects(
    scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "source" }),
    { message: "PUBLIC_OUTPUT_ROOT_REQUIRED" },
  );
});

test("source root must be the Git top level", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const nonGit = path.join(fixture.base, "not-git");
  const gitRoot = path.join(fixture.base, "repo");
  await mkdir(nonGit);
  await initGit(gitRoot);
  await mkdir(path.join(gitRoot, "nested"));
  await fixture.writeInventory(inventory("source"));
  for (const root of [nonGit, path.join(gitRoot, "nested")]) {
    await assert.rejects(
      scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "source", root }),
      { message: "PUBLIC_OUTPUT_NOT_GIT_ROOT" },
    );
  }
});

test("rejects unsafe relative inventory prefixes", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "artifact");
  await mkdir(root);
  for (const entry of ["", "../outside", "C:/outside", "/outside", "folder\\child"]) {
    await fixture.writeInventory(inventory("artifact", { allowedRoots: [entry] }));
    await assert.rejects(
      scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "artifact", root }),
      { message: "PUBLIC_OUTPUT_INVENTORY_INVALID" },
    );
  }
});

test("rejects a resolved path outside its realpath boundary with a redacted code", () => {
  const boundary = path.join(repositoryRoot, "artifact-boundary");
  const outside = path.resolve(boundary, "..", "private-content.txt");
  assert.throws(() => publicOutputPolicy.assertWithinPublicBoundary(boundary, outside), {
    message: "PUBLIC_OUTPUT_OUT_OF_ROOT",
  });
});

test("rejects an internal file symlink without following it", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "artifact");
  await mkdir(path.join(root, "allowed"), { recursive: true });
  await writeFile(path.join(root, "target.txt"), "fixture signal zx9\n");
  await symlink(path.join(root, "target.txt"), path.join(root, "allowed", "link.txt"), "file");
  await fixture.writeInventory(inventory("artifact", { allowedRoots: ["allowed"] }));
  await assert.rejects(
    scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "artifact", root }),
    { message: "PUBLIC_OUTPUT_SYMLINK" },
  );
});

test("rejects a source file symlink before reading its target", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "repo");
  await initGit(root);
  await mkdir(path.join(root, "allowed"));
  await writeFile(path.join(root, "target.txt"), "fixture signal zx9\n");
  await symlink(path.join(root, "target.txt"), path.join(root, "allowed", "link.txt"), "file");
  await fixture.writeInventory(inventory("source", { allowedRoots: ["allowed"] }));
  await assert.rejects(
    scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "source", root }),
    { message: "PUBLIC_OUTPUT_SYMLINK" },
  );
});

test("rejects an external directory symlink without following it", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "images");
  const outside = path.join(fixture.base, "outside");
  await mkdir(path.join(root, "allowed"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(outside, "leak.txt"), "fixture signal zx9\n");
  await symlink(outside, path.join(root, "allowed", "external"), "junction");
  await fixture.writeInventory(inventory("image-root", { allowedRoots: ["allowed"] }));
  await assert.rejects(
    scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "image-root", root }),
    { message: "PUBLIC_OUTPUT_SYMLINK" },
  );
});

test("strings binary strategy scans a neutral phrase between NUL bytes", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "artifact");
  await mkdir(root);
  await writeFile(path.join(root, "binary.bin"), Buffer.from("\0fixture signal zx9\0"));
  await fixture.writeInventory(inventory("artifact", { binaryStrategy: "strings" }));
  const findings = await scanPaths({
    policyPath: fixture.policyPath,
    inventoryPath: fixture.inventoryPath,
    phase: "artifact",
    root,
  });
  assert.deepEqual(findings.map((finding) => finding.source), ["binary.bin"]);
});

test("reject binary strategy fails with a deterministic redacted code", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const root = path.join(fixture.base, "artifact");
  await mkdir(root);
  await writeFile(path.join(root, "private-content.bin"), Buffer.from("\0fixture signal zx9\0"));
  await fixture.writeInventory(inventory("artifact", { binaryStrategy: "reject" }));
  await assert.rejects(
    scanPaths({ policyPath: fixture.policyPath, inventoryPath: fixture.inventoryPath, phase: "artifact", root }),
    (error) =>
      error.message === "PUBLIC_OUTPUT_BINARY_REJECTED" && !error.message.includes("private-content"),
  );
});

test("CLI accepts valid phase, root, and portal combinations", async (t) => {
  const fixture = await fixtureWorkspace(t);
  const sourceRoot = path.join(fixture.base, "repo");
  const artifactRoot = path.join(fixture.base, "artifact");
  await initGit(sourceRoot);
  await mkdir(artifactRoot);
  await writeFile(path.join(artifactRoot, "neutral.txt"), "completely neutral\n");
  for (const [args, options] of [
    [["--phase", "source", "--root", sourceRoot], {}],
    [["--phase", "artifact", "--root", artifactRoot], {}],
    [["--portal", "--phase", "image-root", "--root", artifactRoot], {}],
  ]) {
    const result = await runAudit(args, options);
    assert.match(result.stdout, /^\[[\s\S]*\]\r?\n$/);
    assert.equal(result.stderr, "");
  }
});

test("CLI no-flags uses the repository root from a nested cwd while explicit root is unchanged", async (t) => {
  const auditFixture = await fixtureAuditRepository(t);
  const noFlags = await runAudit([], {
    auditScriptPath: auditFixture.auditScript,
    cwd: auditFixture.nestedCwd,
  });
  assert.equal(noFlags.status, 0);
  assert.match(noFlags.stdout, /^\[[\s\S]*\]\r?\n$/);
  assert.equal(noFlags.stderr, "");

  const fixture = await fixtureWorkspace(t);
  const explicitRoot = path.join(fixture.base, "repo");
  await initGit(explicitRoot);
  const explicit = await runAudit(["--root", explicitRoot], { cwd: auditFixture.nestedCwd });
  assert.equal(explicit.status, 0);
  assert.equal(explicit.stdout, "[]\n");
  assert.equal(explicit.stderr, "");
});

test("CLI rejects missing values, unknown flags, and unsupported phases without content leaks", async () => {
  const secret = "target-file-content-must-not-leak";
  for (const args of [
    ["--root"],
    ["--phase"],
    ["--unknown", secret],
    ["--phase", "deployment", "--root", secret],
  ]) {
    const result = await runAudit(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^PUBLIC_OUTPUT_USAGE\r?\nUsage:/);
    assert.equal(result.stderr.includes(secret), false);
    assert.equal(result.stdout, "");
  }
});

test("requires the release-owner role for the public manifest contract", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../security/public-output-release-manifest.v1.json", import.meta.url)),
  );
  assert.equal(manifest.ownerRole, "release-owner");
  assert.notEqual(manifest.ownerRole, "policy-editor");
});
