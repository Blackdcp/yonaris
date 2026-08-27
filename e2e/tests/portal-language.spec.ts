import { expect, type Page, test } from "@playwright/test";
import {
  LANGUAGE_SMOKE_BRAND_ID,
  LANGUAGE_SMOKE_BRAND_NAME,
  LANGUAGE_SMOKE_PROMPTS,
  LANGUAGE_SMOKE_SCOPES,
  LANGUAGE_SMOKE_USER,
} from "../fixtures";
import { LANGUAGE_SMOKE_AUTH_STATE_PATH } from "../language-auth-setup";

test.describe.configure({ mode: "serial" });

async function chooseLanguage(page: Page, accessibleName: "English" | "简体中文", expectedLang: "en" | "zh-CN") {
  const exactUrl = page.url();
  const radio = page.getByRole("radio", { name: accessibleName, exact: true });
  if (!(await radio.isVisible())) {
    await page
      .getByRole("button", {
        name:
          expectedLang === "zh-CN"
            ? `Account menu for ${LANGUAGE_SMOKE_USER.name}`
            : `${LANGUAGE_SMOKE_USER.name} 的账户菜单`,
        exact: true,
      })
      .click();
    await expect(radio).toBeVisible();
  }
  await Promise.all([page.waitForEvent("load"), radio.check()]);
  await expect(page.locator("html")).toHaveAttribute("lang", expectedLang);
  expect(page.url()).toBe(exactUrl);
}

async function expectRawProgramValues(page: Page) {
  for (const scope of Object.values(LANGUAGE_SMOKE_SCOPES)) {
    await expect(page.getByText(scope.name, { exact: true })).toBeVisible();
    await expect(page.getByText(`${scope.market} / ${scope.locale}`, { exact: true })).toBeVisible();
    await expect(page.getByText(scope.timezone, { exact: true })).toBeVisible();
  }
}

async function ensurePromptExpanded(page: Page, prompt: string) {
  const toggle = page.locator('button[aria-expanded]').filter({ hasText: prompt }).first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

async function expectFanoutHelper(page: Page, helper: string) {
  await page.getByRole("heading", { level: 1 }).locator("[aria-label]").hover();
  await expect(page.getByText(helper, { exact: true }).first()).toBeVisible();
}

async function expectRawSamplingSurface(
  page: Page,
  copy: {
    create: string;
    dialogTitle: string;
    batchName: string;
    cancel: string;
  },
) {
  await page.getByRole("button", { name: copy.create, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: copy.dialogTitle, exact: true });
  await expect(dialog).toBeVisible();

  const scopeSelect = dialog.getByRole("combobox").first();
  await scopeSelect.click();
  await page
    .getByRole("option")
    .filter({ hasText: LANGUAGE_SMOKE_SCOPES.en.name })
    .click();

  await expect(scopeSelect).toContainText(LANGUAGE_SMOKE_SCOPES.en.name);
  await expect(dialog.getByText(LANGUAGE_SMOKE_PROMPTS.en.value, { exact: true })).toBeVisible();
  await expect(dialog.getByText("chatgpt.consumer_web", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: copy.batchName, exact: true })).toHaveValue(
    new RegExp(LANGUAGE_SMOKE_BRAND_NAME),
  );
  await dialog.getByRole("button", { name: copy.cancel, exact: true }).click();
}

test.describe("complete bilingual portal coverage", () => {
  test("anonymous switch preserves the exact login URL, return target, query, and hash", async ({
    browser,
  }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL);
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      const returnTo =
        `/app/${LANGUAGE_SMOKE_BRAND_ID}/query-fan-out` +
        `?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}&model=chatgpt#raw-auth-return`;
      await page.goto(`/auth/login?returnTo=${encodeURIComponent(returnTo)}#language-login`);
      const exactUrl = page.url();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

      await chooseLanguage(page, "简体中文", "zh-CN");

      expect(page.url()).toBe(exactUrl);
      expect(new URL(page.url()).searchParams.get("returnTo")).toBe(returnTo);
      expect(new URL(page.url()).hash).toBe("#language-login");
      await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("authenticated preference persists from the database in a fresh context", async ({
    page,
    browser,
  }, testInfo) => {
    const target =
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/programs` + `?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}#persisted-language`;
    await page.goto(target);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await chooseLanguage(page, "简体中文", "zh-CN");

    const freshContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      storageState: LANGUAGE_SMOKE_AUTH_STATE_PATH,
    });
    try {
      const freshPage = await freshContext.newPage();
      await freshPage.goto(target);
      await expect(freshPage.locator("html")).toHaveAttribute("lang", "zh-CN");
      await expect(freshPage.getByRole("heading", { name: "项目" })).toBeVisible();
      expect(freshPage.url()).toContain(`scope=${LANGUAGE_SMOKE_SCOPES.cn.id}`);
      expect(new URL(freshPage.url()).hash).toBe("#persisted-language");
    } finally {
      await freshContext.close();
    }

    await chooseLanguage(page, "English", "en");
  });

  test("customer overview switches both ways while raw brand and URL identity stay unchanged", async ({ page }) => {
    await page.goto(`/app/${LANGUAGE_SMOKE_BRAND_ID}?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}#customer-overview`);
    await expect(page.getByText(LANGUAGE_SMOKE_BRAND_NAME, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();

    await chooseLanguage(page, "简体中文", "zh-CN");
    await expect(page.getByText(LANGUAGE_SMOKE_BRAND_NAME, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "概览", exact: true })).toBeVisible();
    await chooseLanguage(page, "English", "en");
  });

  test("both Programs and their domain values remain independent of UI language", async ({ page }) => {
    await page.goto(
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/programs` + `?scope=${LANGUAGE_SMOKE_SCOPES.en.id}#program-independence`,
    );
    await expect(page.getByRole("heading", { name: "Programs" })).toBeVisible();
    await expectRawProgramValues(page);

    await chooseLanguage(page, "简体中文", "zh-CN");
    await expect(page.getByRole("heading", { name: "项目" })).toBeVisible();
    await expectRawProgramValues(page);
    await chooseLanguage(page, "English", "en");
  });

  test("query fan-out terminology switches without changing Prompt, query, scope, or URL", async ({ page }) => {
    const target =
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/query-fan-out` +
      `?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}&model=chatgpt#raw-fanout`;
    await page.goto(target);
    const exactTargetUrl = page.url();
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.cn.value, { exact: true })).toBeVisible();
    await ensurePromptExpanded(page, LANGUAGE_SMOKE_PROMPTS.cn.value);
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.cn.derivedQuery, { exact: true })).toBeVisible();

    await chooseLanguage(page, "简体中文", "zh-CN");
    await expect(page.getByText("AI 检索脉络", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "检索路径", exact: true })).toBeVisible();
    await expect(page.getByText("衍生检索词", { exact: true }).first()).toBeVisible();
    await expectFanoutHelper(page, "查看 AI 为回答当前问题而展开的实际联网搜索词。");
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.cn.value, { exact: true })).toBeVisible();
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.cn.derivedQuery, { exact: true })).toBeVisible();
    expect(page.url()).toBe(exactTargetUrl);

    await chooseLanguage(page, "English", "en");
    await expect(page.getByText("Query Fan-Out", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Search Paths", exact: true })).toBeVisible();
    await expect(page.getByText("Derived Queries", { exact: true }).first()).toBeVisible();
    await expectFanoutHelper(
      page,
      "When an AI engine with web search capabilities responds to a prompt, it may choose to make a number of web searches before creating its answer. These underlying web searches, presented here as derived queries, are only available for some engines.",
    );

    await page.goto(
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/query-fan-out` +
        `?scope=${LANGUAGE_SMOKE_SCOPES.en.id}&model=chatgpt#english-program`,
    );
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.en.value, { exact: true })).toBeVisible();
    await ensurePromptExpanded(page, LANGUAGE_SMOKE_PROMPTS.en.value);
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.en.derivedQuery, { exact: true })).toBeVisible();
    await chooseLanguage(page, "简体中文", "zh-CN");
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.en.value, { exact: true })).toBeVisible();
    await expect(page.getByText(LANGUAGE_SMOKE_PROMPTS.en.derivedQuery, { exact: true })).toBeVisible();
    await chooseLanguage(page, "English", "en");
  });

  test("platform administration preserves raw IDs, Prompt, and provider surface keys", async ({ page }) => {
    const target =
      `/admin/sampling?brand=${LANGUAGE_SMOKE_BRAND_ID}` +
      `&scope=${LANGUAGE_SMOKE_SCOPES.en.id}#platform-language-smoke`;
    await page.goto(target);
    const exactTargetUrl = page.url();
    await expect(page.getByRole("heading", { name: "Sampling tasks", exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("brand")).toBe(LANGUAGE_SMOKE_BRAND_ID);
    expect(new URL(page.url()).searchParams.get("scope")).toBe(LANGUAGE_SMOKE_SCOPES.en.id);
    await expectRawSamplingSurface(page, {
      create: "Create batch",
      dialogTitle: "Create sampling batch",
      batchName: "Batch name",
      cancel: "Cancel",
    });

    await chooseLanguage(page, "简体中文", "zh-CN");
    await expect(page.getByRole("heading", { name: "抽样任务", exact: true })).toBeVisible();
    expect(page.url()).toBe(exactTargetUrl);
    await expectRawSamplingSurface(page, {
      create: "创建批次",
      dialogTitle: "创建抽样批次",
      batchName: "批次名称",
      cancel: "取消",
    });
    await chooseLanguage(page, "English", "en");
  });
});
