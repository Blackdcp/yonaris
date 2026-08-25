import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const exec = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
