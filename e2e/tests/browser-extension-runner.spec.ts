import { createHash, randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type BrowserContext, test } from "@playwright/test";
import type { BrowserExtensionSurface } from "@workspace/lib/browser-extension-contract";
import {
  BROWSER_EXTENSION_SURFACE_DEFINITIONS,
  BROWSER_EXTENSION_SURFACES,
  browserExtensionSurfaceDefinition,
} from "@workspace/lib/browser-extension-surfaces";
import pg from "pg";
import { ADMIN_AUTH_STATE_PATH } from "../auth-setup";
import { DATABASE_URL, STEPFUN_BRAND_ID, TEST_API_KEY } from "../fixtures";

const AUTHORIZATION = { Authorization: `Bearer ${TEST_API_KEY}` };
const RUN_SURFACES = BROWSER_EXTENSION_SURFACES;

test.describe.configure({ mode: "serial" });

test("one administrator action completes one Prompt across all seven local browser surfaces", async ({
  browser,
  page: customerPage,
  request,
}) => {
  test.setTimeout(120_000);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const scopeName = `Extension E2E ${suffix}`;
  const scope = await createProgram(request, suffix, scopeName);
  const prompt = await createPrompt(
    request,
    scope.id,
    `Which companies lead China's foundation-model market? ${suffix}`,
  );

  const admin = await browser.newContext({
    baseURL: process.env.BASE_URL ?? "http://localhost:1515",
    storageState: ADMIN_AUTH_STATE_PATH,
  });
  try {
    const adminPage = await admin.newPage();
    const token = await pairFakeExtension(adminPage, request, suffix);

    await adminPage.goto(`/admin/sampling?brand=${STEPFUN_BRAND_ID}`);
    await expect(adminPage.getByRole("heading", { name: "Sampling Tasks" })).toBeVisible({ timeout: 30_000 });
    await adminPage.getByLabel("Program").selectOption(scope.id);
    await expect(adminPage.getByText(/1\s*×\s*7\s*×\s*1\s*=\s*7 tasks/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Run 7 tasks now" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: scopeName }).first()).toBeVisible({ timeout: 20_000 });

    const completed = await drainFakeExtension(request, token);
    expect(completed.map(({ surface }) => surface)).toEqual(RUN_SURFACES);
    const structured = completed[0];
    if (!structured) throw new Error("Seven-surface fixture did not complete a structured observation");

    const database = new pg.Client({ connectionString: DATABASE_URL });
    await database.connect();
    try {
      const result = await database.query<{
        tasks: string;
        successes: string;
        runs: string;
        mentioned: string;
        ready_snapshots: string;
        citations: string;
        search_observed: string;
        query_runs: string;
        structured_v2_runs: string;
        attached_jpegs: string;
      }>(
        `SELECT
           count(DISTINCT t.id)::text AS tasks,
           count(DISTINCT t.id) FILTER (WHERE t.status = 'succeeded')::text AS successes,
           count(DISTINCT r.id)::text AS runs,
           count(DISTINCT r.id) FILTER (WHERE r.brand_mentioned)::text AS mentioned,
           count(DISTINCT rs.id) FILTER (WHERE rs.status = 'ready' AND rs.is_current)::text AS ready_snapshots,
           count(DISTINCT c.id)::text AS citations,
           count(DISTINCT r.id) FILTER (WHERE r.web_search_observed IS TRUE)::text AS search_observed,
           count(DISTINCT r.id) FILTER (WHERE cardinality(r.web_queries) > 0)::text AS query_runs,
           count(DISTINCT r.id) FILTER (WHERE rs.schema_version = 'response-snapshot.v2')::text AS structured_v2_runs,
           count(DISTINCT ea.id) FILTER (
             WHERE ea.status = 'attached' AND ea.kind = 'screenshot' AND ea.media_type = 'image/jpeg'
           )::text AS attached_jpegs
         FROM delivery_batches b
         JOIN delivery_tasks t ON t.batch_id = b.id
         LEFT JOIN prompt_runs r ON r.observation_attempt_id = t.observation_attempt_id
         LEFT JOIN response_snapshots rs ON rs.prompt_run_id = r.id
         LEFT JOIN citations c ON c.prompt_run_id = r.id
         LEFT JOIN evidence_artifacts ea ON ea.observation_attempt_id = r.observation_attempt_id
         WHERE b.brand_id = $1 AND b.scope_id = $2`,
        [STEPFUN_BRAND_ID, scope.id],
      );
      expect(result.rows[0]).toEqual({
        tasks: "7",
        successes: "7",
        runs: "7",
        mentioned: "7",
        ready_snapshots: "7",
        citations: "7",
        search_observed: "7",
        query_runs: "7",
        structured_v2_runs: "7",
        attached_jpegs: "7",
      });
    } finally {
      await database.end();
    }

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/visibility?scope=${scope.id}&lookback=1w`);
    await expect(customerPage.getByRole("heading", { name: "Visibility" })).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByText(prompt.value)).toBeVisible({ timeout: 20_000 });

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/prompts/${prompt.id}`);
    await customerPage.getByText("LLM Responses", { exact: true }).first().click();
    await expect(customerPage.getByText("Captured browser evidence", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    for (const asset of ["html", "json", "manifest"] as const) {
      const response = await customerPage.context().request.get(
        `/api/app/response-snapshots/${structured.snapshotId}?asset=${asset}&download=1`,
      );
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.body();
      expect(createHash("sha256").update(body).digest("hex")).toBe(response.headers()["x-yonaris-sha256"]);
      if (asset === "json") {
        const archived = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
        expect(archived.schemaVersion).toBe("response-snapshot.v2");
        expect(archived).not.toHaveProperty("answerHtml");
      }
    }
    const screenshot = await customerPage.context().request.get(
      `/api/app/response-snapshots/${structured.snapshotId}?asset=screenshot&download=1`,
    );
    expect(screenshot.status(), await screenshot.text()).toBe(200);
    expect(await screenshot.body()).toEqual(structured.jpeg);
    expect(screenshot.headers()["x-yonaris-sha256"]).toBe(createHash("sha256").update(structured.jpeg).digest("hex"));
  } finally {
    await closeContextWithinDeadline(admin, 5_000);
  }
});

async function closeContextWithinDeadline(context: BrowserContext, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const closeResult = context.close({ reason: "Admin setup complete" }).then(
    () => ({ status: "closed" as const }),
    (error: unknown) => ({ status: "error" as const, error }),
  );
  const timeoutResult = new Promise<{ status: "timeout" }>((resolve) => {
    timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });
  const result = await Promise.race([closeResult, timeoutResult]);
  if (timer) clearTimeout(timer);
  if (result.status === "error" && !isAlreadyClosedError(result.error)) throw result.error;
  if (result.status === "timeout") {
    // The Playwright browser fixture still owns the browser process and will
    // finish cleanup. Keep a handler attached so a late close cannot become an
    // unhandled rejection after the product assertions have passed.
    void closeResult.then((lateResult) => {
      if (lateResult.status === "error" && !isAlreadyClosedError(lateResult.error)) {
        console.warn("Timed-out admin context cleanup later failed", lateResult.error);
      }
    });
  }
}

function isAlreadyClosedError(error: unknown): boolean {
  return error instanceof Error && /Target page, context or browser has been closed/i.test(error.message);
}

async function createProgram(request: APIRequestContext, suffix: string, name: string): Promise<{ id: string }> {
  const response = await request.post("/api/v1/measurement-scopes", {
    headers: AUTHORIZATION,
    data: {
      brandId: STEPFUN_BRAND_ID,
      key: `extension-e2e-${suffix}`,
      name,
      market: "CN",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      automaticTargetKeys: [],
      samplingEvaluationRole: "scored",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}

async function createPrompt(
  request: APIRequestContext,
  scopeId: string,
  value: string,
): Promise<{ id: string; value: string }> {
  const response = await request.post("/api/v1/prompts", {
    headers: AUTHORIZATION,
    data: { brandId: STEPFUN_BRAND_ID, scopeId, value },
  });
  expect(response.status(), await response.text()).toBe(201);
  const prompt = (await response.json()) as { id: string };
  return { ...prompt, value };
}

async function pairFakeExtension(
  adminPage: import("@playwright/test").Page,
  request: APIRequestContext,
  suffix: string,
): Promise<string> {
  await adminPage.goto("/admin/sampling");
  await expect(adminPage.getByRole("heading", { name: "Sampling Tasks" })).toBeVisible({ timeout: 30_000 });
  await adminPage.getByRole("link", { name: "Local devices" }).click();
  await expect(adminPage.getByRole("heading", { name: "Local Browser devices" })).toBeVisible({ timeout: 30_000 });
  await adminPage.getByLabel("Device name").fill(`Fixture Chrome ${suffix}`);
  await adminPage.getByLabel("Customer").selectOption(STEPFUN_BRAND_ID);
  await adminPage.getByRole("button", { name: "Create pairing code" }).click();
  const code = (
    await adminPage
      .locator("code")
      .filter({ hasText: /^yrp_[A-Za-z0-9_-]+$/ })
      .textContent()
  )?.trim();
  if (!code) throw new Error("Pairing code was not rendered");

  const response = await request.post("/api/internal/browser-runner/v1/pair", {
    data: {
      code,
      extensionVersion: "0.3.0",
      browserFamily: "chrome",
      browserVersion: "140.0.0",
      platform: "windows",
      supportedSurfaces: [...RUN_SURFACES],
      readiness: Object.fromEntries(
        BROWSER_EXTENSION_SURFACE_DEFINITIONS.map(({ key, adapterVersion }) => [
          key,
          { status: "ready", adapterVersion, activeConcurrency: 0 },
        ]),
      ),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { deviceToken: string; allowedBrandIds: string[] };
  expect(body.allowedBrandIds).toEqual([STEPFUN_BRAND_ID]);
  expect(body.deviceToken).toMatch(/^yrd_[A-Za-z0-9_-]{43}$/);
  return body.deviceToken;
}

async function drainFakeExtension(
  request: APIRequestContext,
  token: string,
): Promise<Array<{ surface: BrowserExtensionSurface; promptId: string; snapshotId: string; jpeg: Buffer }>> {
  const headers = { Authorization: `Bearer ${token}` };
  const completed: Array<{
    surface: BrowserExtensionSurface;
    promptId: string;
    snapshotId: string;
    jpeg: Buffer;
  }> = [];
  for (const surface of RUN_SURFACES) {
    const definition = browserExtensionSurfaceDefinition(surface);
    const response = await request.post("/api/internal/browser-runner/v1/tasks/claim", {
      headers,
      data: {
        brandId: STEPFUN_BRAND_ID,
        surfaceTargetKeys: [surface],
        adapterVersion: definition.adapterVersion,
      },
    });
    expect(response.status(), await response.text()).toBe(200);
    const claim = ((await response.json()) as { claim: RunnerClaim | null }).claim;
    if (!claim) throw new Error(`Fixture extension could not claim ${surface}`);
    completed.push(await completeFakeClaim(request, headers, claim));
  }
  return completed;
}

async function completeFakeClaim(
  request: APIRequestContext,
  headers: Record<string, string>,
  claim: RunnerClaim,
): Promise<{ surface: BrowserExtensionSurface; promptId: string; snapshotId: string; jpeg: Buffer }> {
  const definition = browserExtensionSurfaceDefinition(claim.task.surfaceTargetKey);
  const runnerSessionId = `fixture-${claim.task.id}`;
  const lease = {
    brandId: claim.task.brandId,
    leaseToken: claim.leaseToken,
    leaseGeneration: claim.leaseGeneration,
    runnerSessionId,
    adapterVersion: definition.adapterVersion,
  };
  for (const action of ["submit-intent", "submit-confirmed"] as const) {
    const response = await request.post(`/api/internal/browser-runner/v1/tasks/${claim.task.id}/${action}`, {
      headers,
      data: lease,
    });
    expect(response.status(), await response.text()).toBe(200);
  }

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
  const evidence = await request.post("/api/internal/browser-runner/v1/evidence/", {
    headers: {
      ...headers,
      "Content-Type": "image/jpeg",
      "X-Yonaris-Brand-Id": claim.task.brandId,
      "X-Yonaris-Task-Id": claim.task.id,
      "X-Yonaris-Lease-Token": claim.leaseToken,
      "X-Yonaris-Lease-Generation": String(claim.leaseGeneration),
      "X-Yonaris-Evidence-Kind": "screenshot",
      "X-Yonaris-Filename": encodeURIComponent(`response-${claim.task.id}.jpg`),
      "X-Yonaris-Runner-Session-Id": runnerSessionId,
      "X-Yonaris-Adapter-Version": definition.adapterVersion,
    },
    data: jpeg,
  });
  expect(evidence.status(), await evidence.text()).toBe(201);
  const artifactId = ((await evidence.json()) as { artifact: { id: string } }).artifact.id;
  const answerText = `StepFun is included in this deterministic ${claim.task.surfaceTargetKey} fixture answer.`;
  const complete = await request.post(`/api/internal/browser-runner/v1/tasks/${claim.task.id}/complete`, {
    headers,
    data: {
      ...lease,
      browserVersion: "Chrome-140",
      observation: {
        schemaVersion: "browser-runner-observation.v2",
        answerText,
        observedAt: new Date().toISOString(),
        pageUrl: definition.launchUrl,
        sessionMode: "dedicated_sampling_profile",
        searchMode: "native_auto",
        webSearchObserved: true,
        modelVersion: "consumer-web-fixture-v2",
        evidenceArtifactIds: [artifactId],
        citations: [{ url: `https://example.com/source/${claim.task.id}`, title: "Fixture source" }],
        webQueries: [`fixture query ${claim.task.sampleIndex}`],
        captureDiagnostics: { answerCount: 1, queryCount: 1, citationCount: 1, completionCount: 1 },
      },
    },
  });
  expect(complete.status(), await complete.text()).toBe(200);
  const completion = (await complete.json()) as {
    promptRunId?: string;
    snapshot?: { id: string; status: string };
  };
  if (!completion.promptRunId || !completion.snapshot || completion.snapshot.status !== "ready") {
    throw new Error(`${claim.task.surfaceTargetKey} did not produce a ready structured snapshot`);
  }
  return {
    surface: claim.task.surfaceTargetKey,
    promptId: claim.task.promptId,
    snapshotId: completion.snapshot.id,
    jpeg,
  };
}

type RunnerClaim = {
  task: {
    id: string;
    brandId: string;
    promptId: string;
    sampleIndex: number;
    surfaceTargetKey: BrowserExtensionSurface;
  };
  leaseToken: string;
  leaseGeneration: number;
};
