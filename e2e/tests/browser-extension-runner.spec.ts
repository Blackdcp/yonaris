import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, test } from "@playwright/test";
import pg from "pg";
import { ADMIN_AUTH_STATE_PATH } from "../auth-setup";
import { DATABASE_URL, STEPFUN_BRAND_ID, TEST_API_KEY } from "../fixtures";

const AUTHORIZATION = { Authorization: `Bearer ${TEST_API_KEY}` };
const SURFACES = ["doubao.consumer_web", "deepseek.consumer_web"] as const;

test.describe.configure({ mode: "serial" });

test("platform Run now produces a paired two-channel 30-sample cohort with customer snapshots", async ({
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
    await expect(adminPage.getByText(/3\s*.*\s*2\s*.*\s*5\s*=\s*30 tasks/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Run 30 tasks now" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: scopeName }).first()).toBeVisible({ timeout: 20_000 });

    const completed = await drainFakeExtension(request, token);
    expect(completed).toBe(30);

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
      }>(
        `SELECT
           count(DISTINCT t.id)::text AS tasks,
           count(DISTINCT t.id) FILTER (WHERE t.status = 'succeeded')::text AS successes,
           count(DISTINCT r.id)::text AS runs,
           count(DISTINCT r.id) FILTER (WHERE r.brand_mentioned)::text AS mentioned,
           count(DISTINCT rs.id) FILTER (WHERE rs.status = 'ready' AND rs.is_current)::text AS ready_snapshots,
           count(DISTINCT c.id)::text AS citations
         FROM delivery_batches b
         JOIN delivery_tasks t ON t.batch_id = b.id
         LEFT JOIN prompt_runs r ON r.observation_attempt_id = t.observation_attempt_id
         LEFT JOIN response_snapshots rs ON rs.prompt_run_id = r.id
         LEFT JOIN citations c ON c.prompt_run_id = r.id
         WHERE b.brand_id = $1 AND b.scope_id = $2`,
        [STEPFUN_BRAND_ID, scope.id],
      );
      expect(result.rows[0]).toEqual({
        tasks: "30",
        successes: "30",
        runs: "30",
        mentioned: "24",
        ready_snapshots: "30",
        citations: "30",
      });
    } finally {
      await database.end();
    }

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/visibility?scope=${scope.id}&lookback=1w`);
    await expect(customerPage.getByRole("heading", { name: "Visibility" })).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByText(prompts[0]?.value ?? "missing prompt")).toBeVisible({ timeout: 20_000 });

    await customerPage.goto(`/app/${STEPFUN_BRAND_ID}/prompts/${prompts[0]?.id}`);
    await customerPage.getByText("LLM Responses", { exact: true }).first().click();
    await expect(customerPage.getByText("Browser answer HTML", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await admin.close();
  }
});

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
  await adminPage.goto("/admin/sampling/devices");
  await expect(adminPage.getByRole("heading", { name: "Local Browser devices" })).toBeVisible({ timeout: 30_000 });
  await adminPage.getByLabel("Device name").fill(`Fixture Chrome ${suffix}`);
  await adminPage.getByLabel("Customer").selectOption(STEPFUN_BRAND_ID);
  await adminPage.getByRole("button", { name: "Create pairing code" }).click();
  const code = (await adminPage.locator("code").textContent())?.trim();
  if (!code) throw new Error("Pairing code was not rendered");

  const response = await request.post("/api/internal/browser-runner/v1/pair", {
    data: {
      code,
      extensionVersion: "0.1.0",
      browserFamily: "chrome",
      browserVersion: "140.0.0",
      platform: "windows",
      supportedSurfaces: [...SURFACES],
      readiness: Object.fromEntries(
        SURFACES.map((surface) => [surface, { status: "ready", adapterVersion: "fixture-v1", activeConcurrency: 0 }]),
      ),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { deviceToken: string; allowedBrandIds: string[] };
  expect(body.allowedBrandIds).toEqual([STEPFUN_BRAND_ID]);
  expect(body.deviceToken).toMatch(/^yrd_[A-Za-z0-9_-]{43}$/);
  return body.deviceToken;
}

async function drainFakeExtension(request: APIRequestContext, token: string): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  let completed = 0;
  for (let round = 0; round < 20; round += 1) {
    const claims = (
      await Promise.all(
        SURFACES.flatMap((surface) =>
          Array.from({ length: 5 }, async () => {
            const response = await request.post("/api/internal/browser-runner/v1/tasks/claim", {
              headers,
              data: { brandId: STEPFUN_BRAND_ID, surfaceTargetKeys: [surface] },
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
  const lease = {
    brandId: claim.task.brandId,
    leaseToken: claim.leaseToken,
    leaseGeneration: claim.leaseGeneration,
  };
  const runnerSessionId = `fixture-${claim.task.id}`;
  for (const action of ["submit-intent", "submit-confirmed"] as const) {
    const response = await request.post(`/api/internal/browser-runner/v1/tasks/${claim.task.id}/${action}`, {
      headers,
      data: { ...lease, runnerSessionId },
    });
    expect(response.status(), await response.text()).toBe(200);
  }

  const snapshotHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><article><p>StepFun fixture answer ${claim.task.id}</p></article></body></html>`;
  const evidence = await request.post("/api/internal/browser-runner/v1/evidence/", {
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "X-Yonaris-Brand-Id": claim.task.brandId,
      "X-Yonaris-Task-Id": claim.task.id,
      "X-Yonaris-Lease-Token": claim.leaseToken,
      "X-Yonaris-Lease-Generation": String(claim.leaseGeneration),
      "X-Yonaris-Evidence-Kind": "page_snapshot",
      "X-Yonaris-Filename": encodeURIComponent(`response-${claim.task.id}.html`),
    },
    data: snapshotHtml,
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
      runnerSessionId,
      adapterVersion: "fixture-v1",
      browserVersion: "Chrome-140",
      observation: {
        answerText,
        answerHtml: `<article><p>${answerText}</p></article>`,
        observedAt: new Date().toISOString(),
        pageUrl,
        sessionMode: "dedicated_sampling_profile",
        searchMode: "native_auto",
        webSearchObserved: null,
        modelVersion: "consumer-web-fixture-v1",
        evidenceArtifactIds: [artifactId],
        citations: [{ url: `https://example.com/source/${claim.task.id}`, title: "Fixture source" }],
        webQueries: [`fixture query ${claim.task.sampleIndex}`],
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
    surfaceTargetKey: (typeof SURFACES)[number];
  };
  leaseToken: string;
  leaseGeneration: number;
};
