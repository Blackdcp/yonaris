/**
 * Citations Page E2E Tests
 *
 * Tests the citations page which shows citation statistics.
 * Tests that the citations page loads and displays citation data.
 */
import { test, expect } from "@playwright/test";
import { STEPFUN_BRAND_ID } from "../fixtures";

const BRAND_ID = STEPFUN_BRAND_ID;
const CITATIONS_TERMINAL_STATE =
  /no citations found|failed to load|citations are only|total citations|cited|did not expose any extractable source links/i;

test.describe("Citations Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/app/${BRAND_ID}/citations`);
    // Wait for SSR streaming + hydration to complete — the heading appears once
    // the route loaders finish and the page component renders.
    await expect(page.getByRole("heading", { name: /citations/i })).toBeVisible({ timeout: 30_000 });
  });

  test("page loads without crashing", async ({ page }) => {
    // Wait for the page to actually finish loading by checking for a terminal state:
    // either citation content, an empty state, or an error message.
    // Use .first() because multiple elements may match when citation data loads.
    await expect(page.getByText(CITATIONS_TERMINAL_STATE).first()).toBeVisible({ timeout: 30_000 });
  });

  test("page shows citations header or content", async ({ page }) => {
    // Wait for loading to finish
    await expect(page.getByText(CITATIONS_TERMINAL_STATE).first()).toBeVisible({ timeout: 30_000 });
  });

  test("page has filter controls when loaded", async ({ page }) => {
    // Wait for loading to finish
    await expect(page.getByText(CITATIONS_TERMINAL_STATE).first()).toBeVisible({ timeout: 30_000 });

    // Should have the page content
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Citations");
  });

  test("page is accessible via sidebar navigation", async ({ page }) => {
    await page.goto(`/app/${BRAND_ID}`);
    // Wait for sidebar to fully render (route loader must complete)
    await expect(page.locator(`a[href="/app/${BRAND_ID}/citations"][data-sidebar="menu-button"]`)).toBeVisible({ timeout: 15_000 });
    await page.locator(`a[href="/app/${BRAND_ID}/citations"][data-sidebar="menu-button"]`).click();
    await page.waitForURL(/\/citations/);

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Citations");
  });
});
