import { expect, type Page, test } from "@playwright/test";
import {
  LANGUAGE_SMOKE_BRAND_ID,
  LANGUAGE_SMOKE_BRAND_NAME,
  LANGUAGE_SMOKE_OPPORTUNITIES,
  LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE,
  LANGUAGE_SMOKE_OPPORTUNITY_STORAGE_KEY,
  LANGUAGE_SMOKE_PROMPTS,
  LANGUAGE_SMOKE_REPORT_STORAGE_KEY,
  LANGUAGE_SMOKE_SCOPES,
  LANGUAGE_SMOKE_USER,
} from "../fixtures";
import { LANGUAGE_SMOKE_AUTH_STATE_PATH } from "../language-auth-setup";

test.describe.configure({ mode: "serial" });

type SmokeLanguage = "en" | "zh-CN";

const OPPORTUNITY_LANGUAGE_COMBINATIONS = [
  { uiLanguage: "en", artifactLanguage: "en" },
  { uiLanguage: "zh-CN", artifactLanguage: "en" },
  { uiLanguage: "zh-CN", artifactLanguage: "zh-CN" },
  { uiLanguage: "en", artifactLanguage: "zh-CN" },
] as const;

const REPORT_LANGUAGE_COMBINATIONS = [
  { uiLanguage: "en", artifactLanguage: "en", selector: "Output language" },
  { uiLanguage: "en", artifactLanguage: "zh-CN", selector: "Output language" },
  { uiLanguage: "zh-CN", artifactLanguage: "zh-CN", selector: "输出语言" },
  { uiLanguage: "zh-CN", artifactLanguage: "en", selector: "输出语言" },
] as const;

const OPPORTUNITY_STATIC_COPY = {
  en: {
    selector: "Output language",
    summary: "Summary",
    category: "Content Creation (1)",
    description: "New content to publish or earn for topics where your brand is absent.",
    prompts: "Related Prompts",
    yourCitations: "Your Citations",
    competitorCitations: "Competitor Citations",
    realityCheck: "Reality Check",
  },
  "zh-CN": {
    selector: "输出语言",
    summary: "摘要",
    category: "内容创作 (1)",
    description: "为品牌缺席的主题发布或赢得新的内容。",
    prompts: "相关提示词",
    yourCitations: "你的引用",
    competitorCitations: "竞争对手引用",
    realityCheck: "现实检验",
  },
} as const;

async function chooseLanguage(page: Page, accessibleName: "English" | "简体中文", expectedLang: "en" | "zh-CN") {
  const exactUrl = page.url();
  const radio = page.getByRole("radio", { name: accessibleName, exact: true });
  const option = page.locator(`label[data-language="${expectedLang}"]`);
  if ((await radio.count()) === 0) {
    await page
      .getByRole("button", {
        name:
          expectedLang === "zh-CN"
            ? `Account menu for ${LANGUAGE_SMOKE_USER.name}`
            : `${LANGUAGE_SMOKE_USER.name} 的账户菜单`,
        exact: true,
      })
      .click();
    await expect(option).toBeVisible();
  }
  await option.click();
  await expect(page.locator("html")).toHaveAttribute("lang", expectedLang, { timeout: 30_000 });
  expect(page.url()).toBe(exactUrl);
}

async function ensureUiLanguage(page: Page, expectedLang: SmokeLanguage) {
  if ((await page.locator("html").getAttribute("lang")) === expectedLang) return;
  await chooseLanguage(page, expectedLang === "en" ? "English" : "简体中文", expectedLang);
}

async function expectRawProgramValues(page: Page) {
  for (const scope of Object.values(LANGUAGE_SMOKE_SCOPES)) {
    await expect(page.getByText(scope.name, { exact: true })).toBeVisible();
    await expect(page.getByText(`${scope.market} / ${scope.locale}`, { exact: true })).toBeVisible();
    await expect(page.getByText(scope.timezone, { exact: true })).toBeVisible();
  }
}

async function expectReportLanguageCombination(
  page: Page,
  combination: (typeof REPORT_LANGUAGE_COMBINATIONS)[number],
) {
  await expect(page.locator("html")).toHaveAttribute("lang", combination.uiLanguage);
  const selector = page.getByLabel(combination.selector, { exact: true });
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(combination.artifactLanguage);
  await expect
    .poll(() =>
      page.evaluate((key) => window.sessionStorage.getItem(key), LANGUAGE_SMOKE_REPORT_STORAGE_KEY),
    )
    .toBe(combination.artifactLanguage);
}

async function reloadAndExpectReportLanguageCombination(
  page: Page,
  combination: (typeof REPORT_LANGUAGE_COMBINATIONS)[number],
) {
  await page.reload();
  await expectReportLanguageCombination(page, combination);
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

async function expectOpportunityLanguageCombination(
  page: Page,
  {
    uiLanguage,
    artifactLanguage,
  }: {
    uiLanguage: SmokeLanguage;
    artifactLanguage: SmokeLanguage;
  },
) {
  const staticCopy = OPPORTUNITY_STATIC_COPY[artifactLanguage];
  const selectedVariant = LANGUAGE_SMOKE_OPPORTUNITIES[artifactLanguage];
  const otherVariant = LANGUAGE_SMOKE_OPPORTUNITIES[artifactLanguage === "en" ? "zh-CN" : "en"];

  await expect(page.locator("html")).toHaveAttribute("lang", uiLanguage);
  await expect(page.getByLabel(OPPORTUNITY_STATIC_COPY[uiLanguage].selector, { exact: true })).toHaveValue(
    artifactLanguage,
  );
  expect(
    await page.evaluate(
      (key) => window.sessionStorage.getItem(key),
      LANGUAGE_SMOKE_OPPORTUNITY_STORAGE_KEY,
    ),
  ).toBe(artifactLanguage);

  const report = page.locator('[data-slot="opportunities-report"]');
  await expect(report).toHaveAttribute("lang", artifactLanguage);
  await expect(report.getByText(staticCopy.summary, { exact: true })).toBeVisible();
  await expect(report.getByRole("heading", { name: staticCopy.category, exact: true })).toBeVisible();
  await expect(report.getByText(staticCopy.description, { exact: true })).toBeVisible();
  await expect(report.getByText(selectedVariant.report.summary[0], { exact: true })).toBeVisible();
  await expect(
    report.getByRole("heading", { name: selectedVariant.report.opportunities[0].title, exact: true }),
  ).toBeVisible();
  await expect(report.getByText(selectedVariant.report.opportunities[0].why, { exact: true })).toBeVisible();
  await expect(report.getByRole("heading", { name: staticCopy.realityCheck, exact: true })).toBeVisible();
  await expect(report.getByText(selectedVariant.report.risks[0], { exact: true })).toBeVisible();
  await expect(report.getByText(otherVariant.report.opportunities[0].title, { exact: true })).toHaveCount(0);

  await report
    .getByRole("button", { name: new RegExp(`^${staticCopy.prompts} \\(1\\)`) })
    .click();
  const promptLink = report.getByRole("link", {
    name: LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.prompt.text,
    exact: true,
  });
  await expect(promptLink).toBeVisible();
  await expect(promptLink).toHaveAttribute(
    "href",
    `/app/${LANGUAGE_SMOKE_BRAND_ID}/prompts/${LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.prompt.id}`,
  );

  await report
    .getByRole("button", { name: new RegExp(`^${staticCopy.yourCitations} \\(1\\)`) })
    .click();
  const yourCitationLink = report.getByRole("link", {
    name: `${LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.yourCitation.title} · ${LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.yourCitation.domain}`,
    exact: true,
  });
  await expect(yourCitationLink).toBeVisible();
  await expect(yourCitationLink).toContainText(LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.brand);
  await expect(yourCitationLink).toHaveAttribute("href", LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.yourCitation.url);

  await report
    .getByRole("button", { name: new RegExp(`^${staticCopy.competitorCitations} \\(1\\)`) })
    .click();
  const citationLink = report.getByRole("link", {
    name: `${LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.competitorCitation.title} · ${LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.competitorCitation.domain}`,
    exact: true,
  });
  await expect(citationLink).toBeVisible();
  await expect(citationLink).toContainText(LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.competitor);
  await expect(citationLink).toHaveAttribute("href", LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE.competitorCitation.url);
}

test.describe("complete bilingual portal coverage", () => {
  test("anonymous switch preserves the exact login URL, return target, query, and hash", async ({
    browser,
  }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL);
    const context = await browser.newContext({
      baseURL,
      locale: "en-US",
      storageState: { cookies: [], origins: [] },
    });
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
      await context.close().catch(() => undefined);
    }
  });

  test("authenticated preference persists from the database in a fresh context", async ({
    page,
    browser,
  }, testInfo) => {
    const target =
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/programs` + `?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}#persisted-language`;
    await page.goto(target);
    await ensureUiLanguage(page, "en");
    await chooseLanguage(page, "简体中文", "zh-CN");

    const freshContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      storageState: LANGUAGE_SMOKE_AUTH_STATE_PATH,
    });
    try {
      const freshPage = await freshContext.newPage();
      await freshPage.goto(target);
      await expect(freshPage.locator("html")).toHaveAttribute("lang", "zh-CN");
      const sessionResponse = await freshPage.request.get("/api/auth/get-session");
      expect(sessionResponse.ok()).toBeTruthy();
      const session = (await sessionResponse.json()) as { user?: { uiLanguage?: string } };
      expect(session.user?.uiLanguage).toBe("zh-CN");
      expect(freshPage.url()).toContain(`scope=${LANGUAGE_SMOKE_SCOPES.cn.id}`);
      expect(new URL(freshPage.url()).hash).toBe("#persisted-language");
    } finally {
      await freshContext.close();
    }

    await chooseLanguage(page, "English", "en");
  });

  test("customer overview switches both ways while URL identity stays unchanged", async ({ page }) => {
    await page.goto(`/app/${LANGUAGE_SMOKE_BRAND_ID}?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}#customer-overview`);
    await ensureUiLanguage(page, "en");
    const exactTargetUrl = page.url();
    await expect(page).toHaveTitle(/^Overview\b/);

    try {
      await chooseLanguage(page, "简体中文", "zh-CN");
      await expect(page).toHaveTitle(/^概览(?:\s|$)/);
      expect(page.url()).toBe(exactTargetUrl);
    } finally {
      await ensureUiLanguage(page, "en");
    }
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

  test("Opportunity UI and artifact languages stay independent across reloads with raw evidence unchanged", async ({
    page,
  }) => {
    await page.goto(
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/opportunities` +
        `?scope=${LANGUAGE_SMOKE_SCOPES.cn.id}#opportunity-language-matrix`,
    );
    await ensureUiLanguage(page, "en");

    try {
      await page.getByLabel("Output language", { exact: true }).selectOption("en");
      await expectOpportunityLanguageCombination(page, OPPORTUNITY_LANGUAGE_COMBINATIONS[0]);

      await chooseLanguage(page, "简体中文", "zh-CN");
      await expectOpportunityLanguageCombination(page, OPPORTUNITY_LANGUAGE_COMBINATIONS[1]);

      await page.getByLabel("输出语言", { exact: true }).selectOption("zh-CN");
      await expectOpportunityLanguageCombination(page, OPPORTUNITY_LANGUAGE_COMBINATIONS[2]);

      await chooseLanguage(page, "English", "en");
      await expectOpportunityLanguageCombination(page, OPPORTUNITY_LANGUAGE_COMBINATIONS[3]);
    } finally {
      await ensureUiLanguage(page, "en");
    }
  });

  test("Report creation UI and output languages stay independent across full reloads", async ({ page }) => {
    await page.goto("/reports#report-language-matrix");
    await ensureUiLanguage(page, "en");

    try {
      await expectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[0]);

      await page.getByLabel("Output language", { exact: true }).selectOption("zh-CN");
      await expectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[1]);
      await reloadAndExpectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[1]);

      await chooseLanguage(page, "简体中文", "zh-CN");
      await expectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[2]);
      await reloadAndExpectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[2]);

      await page.getByLabel("输出语言", { exact: true }).selectOption("en");
      await expectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[3]);
      await reloadAndExpectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[3]);

      await chooseLanguage(page, "English", "en");
      await expectReportLanguageCombination(page, REPORT_LANGUAGE_COMBINATIONS[0]);
    } finally {
      await ensureUiLanguage(page, "en");
    }
  });

  test("selecting a missing Chinese Opportunity remains not_generated without a same-origin POST", async ({ page }) => {
    await page.goto(
      `/app/${LANGUAGE_SMOKE_BRAND_ID}/opportunities` +
        `?scope=${LANGUAGE_SMOKE_SCOPES.en.id}#opportunity-not-generated`,
    );
    await ensureUiLanguage(page, "en");
    await expect(
      page.getByText("An administrator has not generated opportunities for this program yet.", { exact: true }),
    ).toBeVisible();

    const sameOriginPosts: string[] = [];
    const origin = new URL(page.url()).origin;
    await page.route(`${origin}/**`, async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        sameOriginPosts.push(request.url());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    let responseBody = "";
    const chineseRead = page.waitForResponse(async (response) => {
      const request = response.request();
      if (!response.ok() || request.method() !== "GET" || new URL(response.url()).origin !== origin) return false;
      const candidateBody = await response.text().catch(() => "");
      if (
        candidateBody.includes("outputLanguage") &&
        candidateBody.includes("zh-CN") &&
        candidateBody.includes("not_generated")
      ) {
        responseBody = candidateBody;
        return true;
      }
      return false;
    });
    await page.getByLabel("Output language", { exact: true }).selectOption("zh-CN");
    await chineseRead;
    expect(responseBody.includes("zh-CN")).toBe(true);
    expect(responseBody.includes("not_generated")).toBe(true);
    await expect(page.getByLabel("Output language", { exact: true })).toHaveValue("zh-CN");
    const storageKey =
      `yonaris:artifact-output-language:v1:opportunities-customer:${LANGUAGE_SMOKE_BRAND_ID}:` +
      LANGUAGE_SMOKE_SCOPES.en.id;
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), storageKey)).toBe("zh-CN");
    await expect(
      page.getByText("An administrator has not generated opportunities for this program yet.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="opportunities-report"]')).toHaveCount(0);
    expect(sameOriginPosts).toHaveLength(0);
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
