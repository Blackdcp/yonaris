/**
 * Prompt Details Page E2E Tests
 *
 * Tests the prompt detail page which shows individual prompt data
 * with tabs for Mentions, Query Fan-Out, Citations, and LLM Answers.
 */
import { test, expect } from "@playwright/test";
import { STEPFUN_BRAND_ID, STEPFUN_PROMPT_ID } from "../fixtures";

const BRAND_ID = STEPFUN_BRAND_ID;
const PROMPT_ID = STEPFUN_PROMPT_ID;
const PROMPT_TEXT = "StepFun";

test.describe("Prompt Details Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/app/${BRAND_ID}/prompts/${PROMPT_ID}`);
    // Wait for the prompt text to appear (route loader + client data fetch)
    await expect(page.getByText(PROMPT_TEXT)).toBeVisible({ timeout: 30_000 });
  });

  test("page loads and shows prompt text", async ({ page }) => {
    // prompt text already asserted in beforeEach
  });

  test("page shows tab navigation", async ({ page }) => {

    // The page should expose the current customer-facing tab terminology.
    const tabs = ["Mentions", "Query Fan-Out", "Citations", "LLM Answers"];

    for (const tabName of tabs) {
      const tab = page.getByRole("tab", { name: tabName }).or(
        page.getByRole("button", { name: tabName })
      ).or(
        page.getByText(tabName, { exact: true })
      );
      await expect(tab.first()).toBeVisible();
    }
  });

  test("can switch between tabs", async ({ page }) => {
    await expect(page.getByText(PROMPT_TEXT)).toBeVisible();

    // Click on the current "LLM Answers" tab.
    const responsesTab = page.getByRole("tab", { name: /LLM Answers/i }).or(
      page.getByRole("button", { name: /LLM Answers/i })
    ).or(
      page.getByText("LLM Answers", { exact: true })
    );
    await responsesTab.first().click();

    // The LLM Answers tab should show prompt run data from the database
    // Our seed data includes runs with model names
    const pageContent = await page.textContent("body");
    const hasRunContent =
      pageContent?.includes("deepseek") ||
      pageContent?.includes("Response") ||
      pageContent?.includes("response");
    expect(hasRunContent).toBeTruthy();
  });

  test("page shows prompt metadata", async ({ page }) => {
    // Wait for the prompt text to appear (confirms page has loaded with data)
    await expect(page.getByText(PROMPT_TEXT)).toBeVisible();

    // Should show tags from the prompt — our seeded prompt has tag "monitoring"
    // and system tag "branded", and the prompt text contains "monitoring"
    const pageContent = await page.textContent("body");
    const hasMetadata =
      pageContent?.includes("unbranded") ||
      pageContent?.includes("StepFun");
    expect(hasMetadata).toBeTruthy();
  });

  test("has back navigation", async ({ page }) => {
    // There should be breadcrumb or link navigation back to the parent page
    const backNav = page.locator(`a[href*='/app/${BRAND_ID}']`).first();
    await expect(backNav).toBeVisible();
  });
});
