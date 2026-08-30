import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const exec = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeDigestEnvironment = {
  WEB_IMAGE_DIGEST: `sha256:${"1".repeat(64)}`,
  WORKER_IMAGE_DIGEST: `sha256:${"2".repeat(64)}`,
  MIGRATE_IMAGE_DIGEST: `sha256:${"3".repeat(64)}`,
  POSTGRES_IMAGE_DIGEST: `sha256:${"4".repeat(64)}`,
};

function workflowJob(workflow, jobName) {
  const start = workflow.indexOf(`\n  ${jobName}:\n`);
  assert.notEqual(start, -1, `missing workflow job: ${jobName}`);
  const remainder = workflow.slice(start + 1);
  const nextJob = remainder.slice(1).search(/\n  [a-z0-9_-]+:\n/u);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob + 1);
}

test("the E2E workflow preserves diagnostics and supplies the base Compose digest contract", async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "e2e.yaml"),
    "utf8",
  );

  for (const contract of [
    `WEB_IMAGE_DIGEST: sha256:${"1".repeat(64)}`,
    `WORKER_IMAGE_DIGEST: sha256:${"2".repeat(64)}`,
    `MIGRATE_IMAGE_DIGEST: sha256:${"3".repeat(64)}`,
    "POSTGRES_IMAGE_DIGEST: ${{ vars.LAS_POSTGRES_IMAGE_DIGEST || 'sha256:97ff59a4e30e08d1c11bdcd9455e7832368c0572b576c9092cde2df4ae5552a3' }}",
    "uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be",
    "uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    "uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    "name: Upload Browser Runner extension",
    "name: Upload Playwright report",
    "name: Upload test results",
  ]) {
    assert.equal(workflow.includes(contract), true, `missing E2E workflow contract: ${contract}`);
  }
  assert.equal(workflow.includes("actions/upload-artifact@v7"), false);
  assert.equal(workflow.includes("actions/cache@v6"), false);
  assert.equal(workflow.includes("jlumbroso/free-disk-space@main"), false);
});

test("the E2E workflow fails fast before parallel quality and integration gates", async () => {
  const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "e2e.yaml"), "utf8");
  const contracts = workflowJob(workflow, "contracts");
  const quality = workflowJob(workflow, "quality");
  const integration = workflowJob(workflow, "integration");

  assert.match(contracts, /name: Verify E2E contracts/u);
  assert.equal(contracts.includes("pnpm install"), false);
  assert.match(quality, /needs: contracts/u);
  assert.match(integration, /needs: contracts/u);
  assert.equal((workflow.match(/name: Verify E2E contracts/gu) ?? []).length, 1);

  for (const contract of [
    "name: Type check",
    "name: Unit tests",
    "name: Build and verify Browser Runner extension",
    "name: Run Browser Runner fixture smoke",
    "name: Storybook tests",
  ]) {
    assert.equal(quality.includes(contract), true, `quality job is missing: ${contract}`);
  }
  for (const contract of [
    "name: Inspect E2E disk headroom",
    "name: Verify E2E disk headroom",
    "name: Build images",
    "name: Run Playwright E2E tests",
    "name: Run Bruno API tests",
    "name: Run sampling delivery test",
    "name: Run worker job-processing test",
  ]) {
    assert.equal(integration.includes(contract), true, `integration job is missing: ${contract}`);
  }
  assert.match(integration, /E2E_MIN_AVAILABLE_KIB: "20971520"/u);
  assert.match(integration, /steps\.disk\.outputs\.cleanup_required == 'true'/u);
});

test("the LAS workflow cancels stale builds but never an active production deploy", async () => {
  const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "deploy-las.yaml"), "utf8");
  const images = workflowJob(workflow, "build-images");
  const snapshotContract = workflowJob(workflow, "response-snapshot-storage-contract");
  const candidateSlot = workflowJob(workflow, "production-candidate-slot");
  const deploy = workflowJob(workflow, "deploy");

  assert.equal(workflow.includes("queue: max"), false);
  assert.equal(workflow.includes("group: yonaris-production\n  cancel-in-progress"), false);
  assert.match(images, /group: yonaris-image-build-\$\{\{ github\.ref \}\}/u);
  assert.match(images, /cancel-in-progress: true/u);
  assert.match(snapshotContract, /group: yonaris-response-contract-\$\{\{ github\.ref \}\}/u);
  assert.match(snapshotContract, /cancel-in-progress: true/u);
  assert.match(candidateSlot, /group: yonaris-production/u);
  assert.match(candidateSlot, /cancel-in-progress: false/u);
  assert.match(deploy, /group: yonaris-production/u);
  assert.match(deploy, /cancel-in-progress: false/u);
  assert.match(deploy, /needs:[\s\S]*- production-candidate-slot/u);
  assert.equal(workflow.includes("actions: write"), false);
  assert.equal(workflow.includes("/cancel"), false);
  assert.equal(workflow.includes("- apps/browser-extension/**"), true);
  assert.equal(workflow.includes("- apps/browser-runner/**"), true);
});

test("the E2E Compose override activates every dependency required by web", async (t) => {
  try {
    await exec("docker", ["compose", "version"], { cwd: repositoryRoot });
  } catch {
    t.skip("Docker Compose is not available in this environment");
    return;
  }

  const { stdout } = await exec(
    "docker",
    [
      "compose",
      "-f",
      "deploy/las/compose.yaml",
      "-f",
      "e2e/worker-override.yaml",
      "config",
      "--services",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        APP_ENV_FILE: path.join(repositoryRoot, "deploy", "las", "env.example"),
        E2E_SNAPSHOT_ROOT: path.join(repositoryRoot, "e2e"),
        IMAGE_TAG: "e2e",
        POSTGRES_DB: "yonaris",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_USER: "postgres",
        ...composeDigestEnvironment,
      },
    },
  );

  const services = new Set(stdout.trim().split(/\r?\n/u));
  for (const service of ["postgres", "db-migrate", "web", "worker"]) {
    assert.equal(services.has(service), true, `${service} must be active in the E2E project`);
  }
});

test("the E2E Compose override exposes Postgres only on loopback for host-side fixtures", async (t) => {
  try {
    await exec("docker", ["compose", "version"], { cwd: repositoryRoot });
  } catch {
    t.skip("Docker Compose is not available in this environment");
    return;
  }

  const { stdout } = await exec(
    "docker",
    [
      "compose",
      "-f",
      "deploy/las/compose.yaml",
      "-f",
      "e2e/worker-override.yaml",
      "config",
      "--format",
      "json",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        APP_ENV_FILE: path.join(repositoryRoot, "deploy", "las", "env.example"),
        E2E_POSTGRES_PORT: "15432",
        E2E_SNAPSHOT_ROOT: path.join(repositoryRoot, "e2e"),
        IMAGE_TAG: "e2e",
        POSTGRES_DB: "yonaris",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_USER: "postgres",
        ...composeDigestEnvironment,
      },
    },
  );

  const config = JSON.parse(stdout);
  assert.deepEqual(config.services.postgres.ports, [
    {
      mode: "ingress",
      target: 5432,
      published: "15432",
      protocol: "tcp",
      host_ip: "127.0.0.1",
    },
  ]);
});
