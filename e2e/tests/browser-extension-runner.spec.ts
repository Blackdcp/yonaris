import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type BrowserContext, test } from "@playwright/test";
import {
  isBrowserExtensionAdapterVersionBindingSatisfied,
  STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS,
} from "@workspace/lib/browser-extension-contract";
import pg from "pg";
import { ADMIN_AUTH_STATE_PATH } from "../auth-setup";
import { DATABASE_URL, STEPFUN_BRAND_ID, TEST_API_KEY } from "../fixtures";

const AUTHORIZATION = { Authorization: `Bearer ${TEST_API_KEY}` };
const DOUBAO_SURFACE = "doubao.consumer_web" as const;
const DEEPSEEK_SURFACE = "deepseek.consumer_web" as const;
const RUN_SURFACES = [DOUBAO_SURFACE] as const;
const DECLARED_SURFACES = [DOUBAO_SURFACE, DEEPSEEK_SURFACE] as const;
const APPROVED_DOUBAO_ADAPTER_VERSION = "doubao-web-20260819-localpc-v8";
const UNQUALIFIED_DEEPSEEK_ADAPTER_VERSION = "deepseek-web-stale";

test.describe.configure({ mode: "serial" });

test("platform Run now produces an approved Doubao 15-sample cohort while DeepSeek remains fail-closed", async ({
  browser,
  page: customerPage,
  request,
}) => {
  test.setTimeout(120_000);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const scopeName = `Extension E2E ${suffix}`;
  const scope = await createProgram(request, suffix, scopeName);
  const prompts = await Promise.all(
    [
      `Which companies lead China's foundation-model market? ${suffix}`,
      `Compare practical enterprise AI platforms for developers. ${suffix}`,
      `Which AI assistant should a Chinese team evaluate? ${suffix}`,
    ].map((value) => createPrompt(request, scope.id, value)),
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
    await expect(adminPage.getByText(/3\s*.*\s*1\s*.*\s*5\s*=\s*15 tasks/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Run 15 tasks now" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: scopeName }).first()).toBeVisible({ timeout: 20_000 });

    await expectDeepSeekClaimRejected(request, token);
    await expectRetiredDoubaoV7ClaimRejected(request, token);
    const structured = await completeOneStructuredV8Claim(scope.id);
    const completed = await drainFakeExtension(request, token);
    expect(completed).toBe(14);

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
        tasks: "15",
        successes: "15",
        runs: "15",
        mentioned: "12",
        ready_snapshots: "15",
        citations: "15",
        search_observed: "15",
        query_runs: "15",
        structured_v2_runs: "15",
        attached_jpegs: "15",
      });
    } finally {
      await database.end();
    }

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/visibility?scope=${scope.id}&lookback=1w`);
    await expect(customerPage.getByRole("heading", { name: "Visibility" })).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByText(prompts[0]?.value ?? "missing prompt")).toBeVisible({ timeout: 20_000 });

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/prompts/${prompts[0]?.id}`);
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

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/prompts/${structured.promptId}`);
    await customerPage.getByText("LLM Responses", { exact: true }).first().click();
    await expect(customerPage.getByText("Captured browser evidence", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
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
			extensionVersion: "0.2.3",
      browserFamily: "chrome",
      browserVersion: "140.0.0",
      platform: "windows",
      supportedSurfaces: [...DECLARED_SURFACES],
      readiness: {
        [DOUBAO_SURFACE]: {
          status: "ready",
          adapterVersion: APPROVED_DOUBAO_ADAPTER_VERSION,
          activeConcurrency: 0,
        },
        [DEEPSEEK_SURFACE]: {
          status: "ready",
          adapterVersion: UNQUALIFIED_DEEPSEEK_ADAPTER_VERSION,
          activeConcurrency: 0,
        },
      },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { deviceToken: string; allowedBrandIds: string[] };
  expect(body.allowedBrandIds).toEqual([STEPFUN_BRAND_ID]);
  expect(body.deviceToken).toMatch(/^yrd_[A-Za-z0-9_-]{43}$/);
  return body.deviceToken;
}

async function expectDeepSeekClaimRejected(request: APIRequestContext, token: string): Promise<void> {
  const response = await request.post("/api/internal/browser-runner/v1/tasks/claim", {
    headers: { Authorization: `Bearer ${token}` },
    data: { brandId: STEPFUN_BRAND_ID, surfaceTargetKeys: [DEEPSEEK_SURFACE] },
  });
  expect(response.status(), await response.text()).toBe(409);
}

async function completeOneStructuredV8Claim(scopeId: string): Promise<{
  promptId: string;
  snapshotId: string;
  jpeg: Buffer;
}> {
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.APP_URL = "http://localhost:1515";
  process.env.RESPONSE_SNAPSHOT_ENABLED = "true";
  process.env.RESPONSE_SNAPSHOT_ROOT = fileURLToPath(new URL("../.snapshot-fixtures", import.meta.url));

  const database = new pg.Client({ connectionString: DATABASE_URL });
  await database.connect();
  let batchId: string | undefined;
  try {
    const batchResult = await database.query<{ id: string }>(
      `SELECT id::text
       FROM delivery_batches
       WHERE brand_id = $1 AND scope_id = $2 AND execution_mode = 'browser_runner'
       ORDER BY created_at DESC
       LIMIT 1`,
      [STEPFUN_BRAND_ID, scopeId],
    );
    batchId = batchResult.rows[0]?.id;
  } finally {
    await database.end();
  }
  if (!batchId) throw new Error("Structured v8 fixture batch was not found");

  const serviceModuleUrl = new URL("../../apps/web/src/server/browser-runner-service.ts", import.meta.url).href;
  const [service, evidence] = await Promise.all([
    import(serviceModuleUrl),
    import("@workspace/lib/db/evidence-artifacts"),
  ]);
  const adapterVersion = STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS[DOUBAO_SURFACE];
  if (!adapterVersion) throw new Error("Doubao structured candidate version is not configured");
  const runnerId = randomUUID();
  const principal = {
    kind: "browser_extension" as const,
    id: runnerId,
    market: "CN" as const,
    locale: "zh-CN" as const,
    timezone: "Asia/Shanghai" as const,
    allowedBrandIds: [STEPFUN_BRAND_ID],
    supportedSurfaces: [DOUBAO_SURFACE],
    readySurfaces: [DOUBAO_SURFACE],
  };
  const futureV8Binding = (surface: typeof DOUBAO_SURFACE | typeof DEEPSEEK_SURFACE, requested: string | undefined) =>
    isBrowserExtensionAdapterVersionBindingSatisfied({
      surface,
      requestedAdapterVersion: requested,
      approvedAdapterVersion: surface === DOUBAO_SURFACE ? adapterVersion : undefined,
    });
  const dependencies = { isAdapterVersionBindingSatisfied: futureV8Binding };
  const claim = await service.claimRunnerTask(
    { brandId: STEPFUN_BRAND_ID, batchId, surfaceTargetKeys: [DOUBAO_SURFACE], adapterVersion },
    principal,
    dependencies,
  );
  if (!claim || claim.task.scopeId !== scopeId) throw new Error("Structured v8 fixture could not claim its task");
  if (
    claim.task.sessionRequirement !== "dedicated_sampling_profile" ||
    claim.task.searchRequirement !== "platform_default"
  ) {
    throw new Error("Structured v8 fixture claimed an incompatible frozen protocol");
  }

  const runnerSessionId = `structured-v8-${claim.task.id}`;
  const lease = {
    brandId: STEPFUN_BRAND_ID,
    leaseToken: claim.leaseToken,
    leaseGeneration: claim.leaseGeneration,
    runnerSessionId,
    adapterVersion,
  };
  await service.recordRunnerSubmitIntent(claim.task.id, lease, principal, dependencies);
  await service.recordRunnerSubmitConfirmed(claim.task.id, lease, principal, dependencies);
  await service.authorizeRunnerEvidenceUpload(
    claim.task.id,
    STEPFUN_BRAND_ID,
    { runnerSessionId, adapterVersion },
    principal,
    dependencies,
  );

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
  const artifact = await evidence.stageEvidenceArtifact({
    brandId: STEPFUN_BRAND_ID,
    claim: {
      taskId: claim.task.id,
      claimedBy: service.runnerClaimant(runnerId),
      leaseToken: claim.leaseToken,
      leaseGeneration: claim.leaseGeneration,
    },
    uploadedBy: service.runnerClaimant(runnerId),
    originalFilename: `structured-${claim.task.id}.jpg`,
    expectedKind: "screenshot",
    content: jpeg,
  });
  const answerText =
    claim.task.sampleIndex === 1
      ? `This deterministic structured ${claim.task.surfaceTargetKey} answer does not name the monitored brand.`
      : `StepFun is included in this deterministic structured ${claim.task.surfaceTargetKey} answer.`;
  const completion = await service.completeRunnerTask(
    claim.task.id,
    {
      ...lease,
      browserVersion: "Chrome-140",
      observation: {
        schemaVersion: "browser-runner-observation.v2",
        answerText,
        observedAt: new Date().toISOString(),
        pageUrl: `https://www.doubao.com/chat/${claim.task.id}`,
        sessionMode: "dedicated_sampling_profile",
        searchMode: "native_auto",
        webSearchObserved: true,
        modelVersion: "consumer-web-fixture-v2",
        evidenceArtifactIds: [artifact.id],
        citations: [{ url: `https://example.com/structured-source/${claim.task.id}`, title: "Structured source" }],
        webQueries: [`structured fixture query ${claim.task.sampleIndex}`],
        captureDiagnostics: { answerCount: 1, queryCount: 1, citationCount: 1, completionCount: 1 },
      },
    },
    principal,
    dependencies,
  );
  if (!completion.promptRunId || !completion.snapshot || completion.snapshot.status !== "ready") {
    throw new Error("Structured v8 fixture did not produce a ready snapshot");
  }
  return { promptId: claim.task.promptId, snapshotId: completion.snapshot.id, jpeg };
}

async function expectRetiredDoubaoV7ClaimRejected(request: APIRequestContext, token: string): Promise<void> {
  const response = await request.post("/api/internal/browser-runner/v1/tasks/claim", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      brandId: STEPFUN_BRAND_ID,
      surfaceTargetKeys: [DOUBAO_SURFACE],
      adapterVersion: "doubao-web-20260818-localpc-v7",
    },
  });
  expect(response.status(), await response.text()).toBe(409);
}

async function drainFakeExtension(request: APIRequestContext, token: string): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  let completed = 0;
  for (let round = 0; round < 20; round += 1) {
    const claims = (
      await Promise.all(
        RUN_SURFACES.flatMap((surface) =>
          Array.from({ length: 5 }, async () => {
            const response = await request.post("/api/internal/browser-runner/v1/tasks/claim", {
              headers,
              data: {
                brandId: STEPFUN_BRAND_ID,
                surfaceTargetKeys: [surface],
                adapterVersion: APPROVED_DOUBAO_ADAPTER_VERSION,
              },
            });
            expect(response.status(), await response.text()).toBe(200);
            return ((await response.json()) as { claim: RunnerClaim | null }).claim;
          }),
        ),
      )
    ).filter((claim): claim is RunnerClaim => claim !== null);
    if (claims.length === 0) return completed;
    await Promise.all(claims.map((claim) => completeFakeClaim(request, headers, claim)));
    completed += claims.length;
  }
  throw new Error("Fixture extension did not drain the started batch");
}

async function completeFakeClaim(
  request: APIRequestContext,
  headers: Record<string, string>,
  claim: RunnerClaim,
): Promise<void> {
  const runnerSessionId = `fixture-${claim.task.id}`;
  const lease = {
    brandId: claim.task.brandId,
    leaseToken: claim.leaseToken,
    leaseGeneration: claim.leaseGeneration,
    runnerSessionId,
    adapterVersion: APPROVED_DOUBAO_ADAPTER_VERSION,
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
      "X-Yonaris-Adapter-Version": APPROVED_DOUBAO_ADAPTER_VERSION,
    },
    data: jpeg,
  });
  expect(evidence.status(), await evidence.text()).toBe(201);
  const artifactId = ((await evidence.json()) as { artifact: { id: string } }).artifact.id;
  const mentionsBrand = claim.task.sampleIndex !== 1;
  const answerText = mentionsBrand
    ? `StepFun is included in this deterministic ${claim.task.surfaceTargetKey} fixture answer.`
    : `This deterministic ${claim.task.surfaceTargetKey} fixture answer does not name the monitored brand.`;
  const pageUrl =
    claim.task.surfaceTargetKey === "doubao.consumer_web"
      ? `https://www.doubao.com/chat/${claim.task.id}`
      : `https://chat.deepseek.com/a/chat/s/${claim.task.id}`;
  const complete = await request.post(`/api/internal/browser-runner/v1/tasks/${claim.task.id}/complete`, {
    headers,
    data: {
      ...lease,
      browserVersion: "Chrome-140",
      observation: {
        schemaVersion: "browser-runner-observation.v2",
        answerText,
        observedAt: new Date().toISOString(),
        pageUrl,
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
}

type RunnerClaim = {
  task: {
    id: string;
    brandId: string;
    sampleIndex: number;
    surfaceTargetKey: (typeof RUN_SURFACES)[number];
  };
  leaseToken: string;
  leaseGeneration: number;
};
