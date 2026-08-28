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
