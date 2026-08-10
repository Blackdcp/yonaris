/**
 * Sampling delivery E2E
 *
 * This test deliberately never opens a real AI consumer surface. It proves
 * that an operator can freeze a contractual denominator, claim one task,
 * upload server-managed evidence, submit an observation, and see that sample
 * enter the scoped ledger and analytics. Clean-session and execution-market
 * truth still require a separate witnessed/manual UAT.
 */
import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { DATABASE_URL, TEST_API_KEY, TEST_BRAND_ID } from "../fixtures";

const AUTHORIZATION = { Authorization: `Bearer ${TEST_API_KEY}` };

test.describe.configure({ mode: "serial" });

test("freezes, executes, evidences, and accounts for one scored sample", async ({ page, request }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const scopeKey = `sampling-e2e-${suffix}`;
  const scopeName = `Sampling E2E ${suffix}`;
  const promptValue = `Sampling E2E ${suffix}: which organization is represented in this answer?`;
  const batchName = `Sampling delivery ${suffix}`;

  const scopeResponse = await request.post("/api/v1/measurement-scopes", {
    headers: AUTHORIZATION,
    data: {
      brandId: TEST_BRAND_ID,
      key: scopeKey,
      name: scopeName,
      market: "CN",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      automaticTargetKeys: [],
      samplingEvaluationRole: "scored",
    },
  });
  expect(scopeResponse.status(), await scopeResponse.text()).toBe(201);
  const scope = (await scopeResponse.json()) as { id: string };

  const promptResponse = await request.post("/api/v1/prompts", {
    headers: AUTHORIZATION,
    data: { brandId: TEST_BRAND_ID, scopeId: scope.id, value: promptValue },
  });
  expect(promptResponse.status(), await promptResponse.text()).toBe(201);
  const prompt = (await promptResponse.json()) as { id: string };

  await page.goto(`/admin/sampling?brand=${TEST_BRAND_ID}`);
  await expect(page.getByRole("heading", { name: "Sampling Tasks" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create batch" }).click();
  const batchDialog = page.getByRole("dialog", { name: "Create sampling batch" });
  await expect(batchDialog).toBeVisible();
  await batchDialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: new RegExp(scopeName) }).click();
  await batchDialog.getByLabel("Batch name").fill(batchName);
  await batchDialog.locator(`[id="sampling-prompt-${prompt.id}"]`).click();
  await batchDialog.locator('[id="sampling-target-doubao.consumer_web"]').click();
  await batchDialog.getByRole("button", { name: "Create and freeze batch" }).click();

  const batchRow = page.getByRole("row").filter({ hasText: batchName });
  await expect(batchRow).toBeVisible({ timeout: 20_000 });
  await batchRow.getByRole("button", { name: "Claim next" }).click();
  await page.waitForURL(/\/admin\/sampling\/[0-9a-f-]+\?brand=default/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sampling Workbench" })).toBeVisible();

  const taskId = new URL(page.url()).pathname.split("/").at(-1);
  if (!taskId) throw new Error("Claimed sampling task ID was missing from the workbench URL");
  expect(taskId).toMatch(/^[0-9a-f-]{36}$/);
  expect(page.url()).not.toContain("leaseToken");
  const storedLease = await page.evaluate((id) => window.sessionStorage.getItem(`yonaris:sampling-claim:${id}`), taskId);
  expect(storedLease).toContain('"leaseToken"');
  const parsedLease = JSON.parse(storedLease ?? "null") as { leaseToken: string; leaseGeneration: number };

  await page.getByLabel("Result page URL").fill("https://www.doubao.com/chat/e2e-result");
  await page
    .getByLabel("Complete answer")
    .fill("Test Organization is the organization represented in this complete consumer-surface answer.");
  await page.getByLabel("Citation URLs").fill("https://example.com/e2e-source");
  await page.getByLabel(/I confirm this run was executed/).check();

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const expectedEvidenceSha256 = createHash("sha256").update(tinyPng).digest("hex");

  const rejectedStatuses = await page.evaluate(
    async ({ currentGeneration, leaseToken, pngBytes, taskId: claimedTaskId }) => {
      const upload = (token: string, generation: number, bytes: number[], filename: string) =>
        fetch("/api/admin/sampling/evidence", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Yonaris-Brand-Id": "default",
            "X-Yonaris-Task-Id": claimedTaskId,
            "X-Yonaris-Lease-Token": token,
            "X-Yonaris-Lease-Generation": String(generation),
            "X-Yonaris-Evidence-Kind": "screenshot",
            "X-Yonaris-Filename": encodeURIComponent(filename),
          },
          body: new Uint8Array(bytes),
        });
      const staleLease = await upload(leaseToken, currentGeneration + 1, pngBytes, "stale.png");
      const invalidContent = await upload(
        leaseToken,
        currentGeneration,
        [...new TextEncoder().encode("<svg/>")],
        "fake.png",
      );
      return [staleLease.status, invalidContent.status];
    },
    {
      currentGeneration: parsedLease.leaseGeneration,
      leaseToken: parsedLease.leaseToken,
      pngBytes: [...tinyPng],
      taskId,
    },
  );
  expect(rejectedStatuses).toEqual([409, 415]);

  const uploadRequestPromise = page.waitForRequest(
    (candidate) => candidate.method() === "POST" && candidate.url().endsWith("/api/admin/sampling/evidence"),
  );
  await page.getByLabel("Upload evidence").setInputFiles({
    name: "sampling-evidence.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  const uploadRequest = await uploadRequestPromise;
  expect(uploadRequest.url()).not.toContain("lease");
  expect(uploadRequest.headers().authorization).toBeUndefined();
  await expect(page.getByTestId("sampling-evidence-ready").filter({ hasText: "sampling-evidence.png" })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Submit observation" }).click();
  await page.waitForURL(new RegExp(`/admin/sampling\\?brand=${TEST_BRAND_ID}`), { timeout: 20_000 });

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let batchId: string;
  let evidenceArtifactId: string;
  try {
    const batchResult = await client.query<{ id: string; status: string; manifest_hash: string }>(
      `SELECT id, status, manifest_hash
         FROM delivery_batches
        WHERE brand_id = $1 AND scope_id = $2 AND name = $3
        ORDER BY created_at DESC
        LIMIT 1`,
      [TEST_BRAND_ID, scope.id, batchName],
    );
    expect(batchResult.rows).toHaveLength(1);
    const batch = batchResult.rows[0];
    if (!batch) throw new Error("Sampling batch was not persisted");
    batchId = batch.id;
    expect(batch.status).toBe("completed");
    expect(batch.manifest_hash).toMatch(/^[a-f0-9]{64}$/);

    const ledgerResult = await client.query<{
      task_status: string;
      attempt_status: string;
      capture_metadata: Record<string, unknown>;
      run_id: string;
      brand_mentioned: boolean;
      citation_count: string;
      evidence_count: string;
      evidence_artifact_id: string;
      evidence_status: string;
      evidence_sha256: string;
    }>(
      `SELECT t.status AS task_status,
              a.status AS attempt_status,
              a.capture_metadata::jsonb AS capture_metadata,
              r.id AS run_id,
              r.brand_mentioned,
              COUNT(DISTINCT c.id)::text AS citation_count,
              COUNT(DISTINCT e.id)::text AS evidence_count,
              MIN(e.id::text) AS evidence_artifact_id,
              MIN(e.status::text) AS evidence_status,
              MIN(e.sha256) AS evidence_sha256
         FROM delivery_tasks t
         JOIN observation_attempts a ON a.id = t.observation_attempt_id
         JOIN prompt_runs r ON r.observation_attempt_id = a.id
         LEFT JOIN citations c ON c.prompt_run_id = r.id
         LEFT JOIN evidence_artifacts e ON e.observation_attempt_id = a.id
        WHERE t.batch_id = $1
        GROUP BY t.status, a.status, a.capture_metadata::jsonb, r.id, r.brand_mentioned`,
      [batchId],
    );
    expect(ledgerResult.rows).toEqual([
      expect.objectContaining({
        task_status: "succeeded",
        attempt_status: "succeeded",
        capture_metadata: expect.objectContaining({
          measurementEligibility: "operator_attested_clean_session",
          operatorAttested: true,
          reportedMarket: "CN",
          reportedLocale: "zh-CN",
          executionMarketVerified: false,
          evidenceRefs: [
            expect.objectContaining({
              sha256: expectedEvidenceSha256,
              type: "screenshot",
            }),
          ],
        }),
        brand_mentioned: true,
        citation_count: "1",
        evidence_count: "1",
        evidence_status: "attached",
        evidence_sha256: expectedEvidenceSha256,
      }),
    ]);
    const ledger = ledgerResult.rows[0];
    if (!ledger) throw new Error("Sampling observation ledger was not persisted");
    evidenceArtifactId = ledger.evidence_artifact_id;
  } finally {
    await client.end();
  }

  const evidenceDownload = await request.get(
    `/api/admin/sampling/evidence/${evidenceArtifactId}?brandId=${TEST_BRAND_ID}`,
  );
  expect(evidenceDownload.status()).toBe(200);
  expect(evidenceDownload.headers()["x-yonaris-sha256"]).toBe(expectedEvidenceSha256);
  expect(Buffer.from(await evidenceDownload.body())).toEqual(tinyPng);

  const coverageResponse = await request.get(
    `/api/v1/observations/coverage?brandId=${TEST_BRAND_ID}&scopeId=${scope.id}&batchId=${batchId}`,
    { headers: AUTHORIZATION },
  );
  expect(coverageResponse.status(), await coverageResponse.text()).toBe(200);
  const coverage = (await coverageResponse.json()) as {
    batchStatus: string;
    manifestHash: string;
    coverageBasis: string;
    contractualManifestApplied: boolean;
    overall: { total: number; succeeded: number; completionCoverage: number | null };
    byEvaluationRole: { scored: { total: number; succeeded: number }; observation: { total: number } };
  };
  expect(coverage).toMatchObject({
    batchStatus: "completed",
    coverageBasis: "delivery_manifest",
    contractualManifestApplied: true,
    overall: { total: 1, succeeded: 1, completionCoverage: 1 },
    byEvaluationRole: {
      scored: { total: 1, succeeded: 1 },
      observation: { total: 0 },
    },
  });
  expect(coverage.manifestHash).toMatch(/^[a-f0-9]{64}$/);

  await page.goto(`/app/${TEST_BRAND_ID}/visibility?scope=${scope.id}&lookback=1w`);
  await expect(page.getByRole("heading", { name: "Visibility" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(promptValue)).toBeVisible({ timeout: 20_000 });
});
