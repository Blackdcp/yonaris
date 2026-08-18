import { expect, test } from "@playwright/test";
import pg from "pg";
import { CUSTOMER_AUTH_STATE_PATH } from "../customer-auth-setup";
import {
  CUSTOMER_TEST_USER,
  DATABASE_URL,
  MEMTENSOR_BRAND_ID,
  STEPFUN_BRAND_ID,
  STEPFUN_BRAND_NAME,
} from "../fixtures";

test.use({ storageState: CUSTOMER_AUTH_STATE_PATH });
test.describe.configure({ mode: "serial" });

test.describe("real StepFun customer identity boundary", () => {
  test("logs in as an ordinary analyst and renders only the fixed customer shell", async ({
    page,
    request,
  }) => {
    const sessionResponse = await request.get("/api/auth/get-session");
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { email?: string; role?: string };
    };
    expect(session.user).toMatchObject({
      email: CUSTOMER_TEST_USER.email,
      role: "user",
    });

    await page.goto(`/app/${STEPFUN_BRAND_ID}`);
    await expect(
      page.locator(
        `a[href="/app/${STEPFUN_BRAND_ID}"][data-sidebar="menu-button"]`,
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(STEPFUN_BRAND_NAME, { exact: true }).first()).toBeVisible();

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByText("Dashboard", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Programs", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Settings", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Platform administration", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText("Sampling operations", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText("Automation", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText("Provider tools", { exact: true })).toHaveCount(0);
  });

  test("fails closed for platform routes and another customer's workspace", async ({
    page,
  }) => {
    const adminResponse = await page.goto("/admin");
    expect(adminResponse?.status()).toBe(404);
    await expect(page.getByText("404 Not Found", { exact: true })).toBeVisible();

    const otherCustomerResponse = await page.goto(`/app/${MEMTENSOR_BRAND_ID}`);
    expect(otherCustomerResponse?.status()).toBe(404);
    await expect(page.getByText("404 Not Found", { exact: true })).toBeVisible();

    await page.goto("/app");
    await expect(page.locator(`a[href="/app/${STEPFUN_BRAND_ID}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/app/${MEMTENSOR_BRAND_ID}"]`)).toHaveCount(0);
  });

  test("cannot invoke sampling, evidence storage, provider settings, or paid generation", async ({
    page,
    request,
  }) => {
    const adminSamplingResponse = await page.goto("/admin/sampling");
    expect(adminSamplingResponse?.status()).toBe(404);

    const providerSettingsResponse = await page.goto(
      `/app/${STEPFUN_BRAND_ID}/settings/llms`,
    );
    expect(providerSettingsResponse?.status()).toBe(404);

    await page.goto(`/app/${STEPFUN_BRAND_ID}`);
    const origin = new URL(page.url()).origin;
    const evidenceResponse = await request.post("/api/admin/sampling/evidence", {
      headers: {
        Origin: origin,
        "Content-Type": "image/png",
      },
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    expect(evidenceResponse.status()).toBe(403);
    await expect(evidenceResponse.json()).resolves.toMatchObject({
      message: "Administrator access required",
    });

    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const before = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM brand_opportunities WHERE brand_id = $1`,
        [STEPFUN_BRAND_ID],
      );

      await page.goto(`/app/${STEPFUN_BRAND_ID}/opportunities`);
      await expect(page.getByRole("heading", { name: "Opportunities" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByText(/an administrator has not generated opportunities for this Program yet/i).first(),
      ).toBeVisible({
        timeout: 30_000,
      });

      const after = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM brand_opportunities WHERE brand_id = $1`,
        [STEPFUN_BRAND_ID],
      );
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    } finally {
      await client.end();
    }
  });
});
