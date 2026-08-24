import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import pg from "pg";
import { CUSTOMER_AUTH_STATE_PATH } from "../customer-auth-setup";
import {
  DATABASE_URL,
  MEMTENSOR_SNAPSHOT_ID,
  STEPFUN_BRAND_ID,
  STEPFUN_PROMPT_ID,
  STEPFUN_SNAPSHOT_EXPORT_DAYS_AGO,
  STEPFUN_SNAPSHOT_IDS,
  STEPFUN_SNAPSHOT_RUN_IDS,
} from "../fixtures";

test.use({ storageState: CUSTOMER_AUTH_STATE_PATH });
test.describe.configure({ mode: "serial" });

test.describe("customer response snapshot archive", () => {
  test("renders overseas and domestic archives through the same read-only component", async ({ page }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("attacker.invalid")) externalRequests.push(request.url());
    });

    await page.goto(`/app/${STEPFUN_BRAND_ID}/prompts/${STEPFUN_PROMPT_ID}`);
    await page.getByText("LLM Responses", { exact: true }).first().click();

    await expect(page.getByText("Provider answer HTML", { exact: false })).toBeVisible();
    await expect(page.getByText("Rendered structured response", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Browser answer HTML", { exact: false })).toBeVisible();
    await expect(page.getByText("Snapshot is being prepared", { exact: true })).toBeVisible();
    await expect(page.getByText("Snapshot is unavailable", { exact: true })).toBeVisible();
    await expect(page.getByText("Snapshot has expired", { exact: true })).toBeVisible();

    const chatgptFrame = page.frameLocator('iframe[title="Archived response from chatgpt"]');
    await expect(chatgptFrame.getByText("Sanitized native answer.", { exact: true })).toBeVisible();
    await expect(chatgptFrame.locator("script, iframe, img")).toHaveCount(0);
    await expect(page.locator('iframe[title="Archived response from perplexity"]')).toBeVisible();
    await expect(page.locator('iframe[title="Archived response from doubao"]')).toBeVisible();
    await expect(page.getByText("Captured browser evidence", { exact: true })).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(externalRequests).toEqual([]);
  });

  test("serves hash-verifiable own-brand assets and fails closed across tenants and states", async ({
    browser,
    request,
  }, testInfo) => {
    for (const asset of ["html", "json", "manifest"] as const) {
      const response = await request.get(
        `/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.nativeHtml}?asset=${asset}&download=1`,
      );
      expect(response.status()).toBe(200);
      const body = await response.body();
      expect(createHash("sha256").update(body).digest("hex")).toBe(response.headers()["x-yonaris-sha256"]);
      expect(response.headers()["content-disposition"]).toContain("attachment");
    }

    const otherTenant = await request.get(
      `/api/app/response-snapshots/${MEMTENSOR_SNAPSHOT_ID}?asset=json&download=1`,
    );
    expect(otherTenant.status()).toBe(404);
    expect(
      (
        await request.get(
          `/api/app/response-snapshots/${MEMTENSOR_SNAPSHOT_ID}?asset=screenshot&download=0`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(
          `/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.domesticBrowser}?asset=screenshot&download=0`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(
          `/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.pending}?asset=json&download=1`,
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.get(`/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.failed}?asset=json&download=1`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(`/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.expired}?asset=json&download=1`)
      ).status(),
    ).toBe(410);

    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== "string") throw new Error("E2E baseURL is required");
    const anonymous = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.request.get(
        `/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.nativeHtml}?asset=json&download=1`,
      );
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.close();
    }
  });

  test("exports only current authorized ready artifacts", async ({ request }) => {
    const end = shiftDate(beijingDate(new Date()), -STEPFUN_SNAPSHOT_EXPORT_DAYS_AGO);
    const start = end;
    const query = new URLSearchParams({ brandId: STEPFUN_BRAND_ID, start, end });
    const estimate = await request.get(`/api/app/response-snapshots/export?${query}&mode=estimate`);
    expect(estimate.status()).toBe(200);
    await expect(estimate.json()).resolves.toMatchObject({ count: 3, startDate: start, endDate: end });

    const download = await request.get(`/api/app/response-snapshots/export?${query}&mode=download`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toBe("application/zip");
    const entries = Object.keys(unzipSync(new Uint8Array(await download.body()))).filter(
      (entry) => !entry.endsWith("/"),
    );
    expect(entries).toHaveLength(9);
    const allowedRunIds = new Set<string>([
      STEPFUN_SNAPSHOT_RUN_IDS.nativeHtml,
      STEPFUN_SNAPSHOT_RUN_IDS.renderedFallback,
      STEPFUN_SNAPSHOT_RUN_IDS.domesticBrowser,
    ]);
    expect(
      entries.every((entry) => {
        const parts = entry.split("/");
        return parts.length === 4 && parts[2] !== undefined && allowedRunIds.has(parts[2]);
      }),
    ).toBe(true);
  });

  test("keeps Yonaris metric inputs intact when snapshot storage is failed", async ({ request }) => {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const before = await readMetricInputs(client);
      expect(before).toEqual({ totalRuns: 6, mentionedRuns: 3, failedSnapshots: 1 });

      const failedAsset = await request.get(
        `/api/app/response-snapshots/${STEPFUN_SNAPSHOT_IDS.failed}?asset=html&download=0`,
      );
      expect(failedAsset.status()).toBe(404);
      expect(await readMetricInputs(client)).toEqual(before);
    } finally {
      await client.end();
    }
  });
});

async function readMetricInputs(client: pg.Client): Promise<{
  totalRuns: number;
  mentionedRuns: number;
  failedSnapshots: number;
}> {
  const result = await client.query<{ total_runs: string; mentioned_runs: string; failed_snapshots: string }>(
    `SELECT
       count(*)::text AS total_runs,
       count(*) FILTER (WHERE pr.brand_mentioned)::text AS mentioned_runs,
       count(*) FILTER (WHERE rs.status = 'failed')::text AS failed_snapshots
     FROM prompt_runs pr
     LEFT JOIN response_snapshots rs
       ON rs.prompt_run_id = pr.id AND rs.is_current
     WHERE pr.prompt_id = $1`,
    [STEPFUN_PROMPT_ID],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Metric fixture query returned no row");
  return {
    totalRuns: Number(row.total_runs),
    mentionedRuns: Number(row.mentioned_runs),
    failedSnapshots: Number(row.failed_snapshots),
  };
}

function beijingDate(value: Date): string {
  return new Date(value.getTime() + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
