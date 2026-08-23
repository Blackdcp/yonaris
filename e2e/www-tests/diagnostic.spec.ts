import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const locales = [
	{
		locale: "en" as const,
		route: "/diagnostic",
		website: "Website",
		brand: "Brand",
		market: "Market or category",
		question: "Market question",
		competitors: "Competitors to include",
		name: "Your name",
		email: "Work email",
		consent: /I agree that Yonaris/,
		continue: "Continue",
		back: "Back to scope",
		submit: "Request the diagnostic",
		retry: "Try again",
		submitting: "Submitting request…",
		success: "Request submitted for review",
		failure: "We couldn’t confirm delivery",
		fallback: "Open email draft",
		scopeProgress: "1 / Scope",
		contactProgress: "2 / Contact",
		h1: "See what AI sees before you decide what to change.",
	},
	{
		locale: "zh" as const,
		route: "/zh/diagnostic",
		website: "官网",
		brand: "品牌",
		market: "市场或品类",
		question: "市场问题",
		competitors: "需要纳入的竞品",
		name: "你的姓名",
		email: "工作邮箱",
		consent: /我同意 Yonaris/,
		continue: "继续",
		back: "返回范围",
		submit: "申请免费诊断",
		retry: "重试",
		submitting: "正在提交申请…",
		success: "申请已提交审核",
		failure: "我们无法确认申请是否送达",
		fallback: "打开邮件草稿",
		scopeProgress: "1 / 范围",
		contactProgress: "2 / 联系",
		h1: "先看见 AI 看见了什么 再决定改变什么",
	},
] as const;

type LocaleFixture = (typeof locales)[number];

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function openScope(page: Page, fixture: LocaleFixture): Promise<void> {
	await page.goto(`${fixture.route}?website=https%3A%2F%2Facme.example`);
	await waitForHydration(page);
}

async function completeScope(page: Page, fixture: LocaleFixture): Promise<void> {
	await page.getByLabel(fixture.brand, { exact: true }).fill("Acme");
	await page.getByLabel(fixture.market, { exact: true }).fill("Enterprise software");
	await page.getByLabel(fixture.question, { exact: true }).fill("Which platform should a global team choose?");
	await page.getByRole("button", { name: fixture.continue, exact: true }).click();
}

async function completeContact(page: Page, fixture: LocaleFixture): Promise<void> {
	await page.getByLabel(fixture.competitors, { exact: true }).fill("Example Co");
	await page.getByLabel(fixture.name, { exact: true }).fill("Ava Chen");
	await page.getByLabel(fixture.email, { exact: true }).fill("ava@acme.example");
	await page.getByLabel(fixture.consent).check();
}

async function completeDiagnostic(page: Page, fixture: LocaleFixture): Promise<void> {
	await openScope(page, fixture);
	await completeScope(page, fixture);
	await completeContact(page, fixture);
}

function fulfillJson(route: Route, status: number, body: string): Promise<void> {
	return route.fulfill({ status, contentType: "application/json", body });
}

function expectedMailDraftLines(fixture: LocaleFixture): readonly string[] {
	return fixture.locale === "zh"
		? [
				"官网: https://acme.example",
				"品牌: Acme",
				"市场或品类: Enterprise software",
				"市场问题: Which platform should a global team choose?",
				"需要纳入的竞品: Example Co",
				"姓名: Ava Chen",
				"邮箱: ava@acme.example",
			]
		: [
				"Website: https://acme.example",
				"Brand: Acme",
				"Market or category: Enterprise software",
				"Market question: Which platform should a global team choose?",
				"Competitors to include: Example Co",
				"Name: Ava Chen",
				"Email: ava@acme.example",
			];
}

async function expectCompleteMailDraft(page: Page, fixture: LocaleFixture): Promise<void> {
	const fallback = page.getByRole("link", { name: fixture.fallback, exact: true });
	const href = decodeURIComponent((await fallback.getAttribute("href")) ?? "");
	expect(href).toContain("mailto:black.dcp@outlook.com");
	for (const line of expectedMailDraftLines(fixture)) expect(href).toContain(line);
}

async function expectMinimumTarget(target: Locator, label: string): Promise<void> {
	const box = await target.boundingBox();
	expect(box?.height ?? 0, `${label} should expose a target at least 44px tall`).toBeGreaterThanOrEqual(44);
}

async function expectVisibleProgrammaticFocus(target: Locator, label: string): Promise<void> {
	await expect(target).toBeFocused();
	const presentation = await target.evaluate((element) => {
		const style = getComputedStyle(element);
		return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
	});
	expect(
		presentation.boxShadow !== "none" ||
			(presentation.outlineStyle !== "none" && Number.parseFloat(presentation.outlineWidth) > 0),
		`${label} should render a visible focus indicator`,
	).toBe(true);
}

async function expectSignalFocusFromCleanState(page: Page, target: Locator): Promise<void> {
	await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
	await expectSignalFocusVisible(page, target);
}

for (const fixture of locales) {
	test(`${fixture.route} validates scope before any request and focuses the first invalid field`, async ({ page }) => {
		let requestCount = 0;
		page.on("request", (request) => {
			if (request.url().endsWith("/api/diagnostic")) requestCount += 1;
		});
		await page.goto(fixture.route);
		await waitForHydration(page);

		await expect(page.getByRole("heading", { level: 1, name: fixture.h1, exact: true })).toHaveCount(1);
		await expect(page.locator(".diagnostic-sheet__masthead li").filter({ hasText: fixture.scopeProgress })).toHaveAttribute(
			"aria-current",
			"step",
		);
		await page.getByRole("button", { name: fixture.continue, exact: true }).click();

		await expect(page.locator("#diagnostic-website")).toBeFocused();
		await expect(page.getByRole("alert")).toBeVisible();
		expect(requestCount).toBe(0);
	});

	test(`${fixture.route} preserves every value when moving backward`, async ({ page }) => {
		await openScope(page, fixture);
		await completeScope(page, fixture);
		await completeContact(page, fixture);

		await expect(page.locator(".diagnostic-sheet__masthead li").filter({ hasText: fixture.contactProgress })).toHaveAttribute(
			"aria-current",
			"step",
		);
		await page.getByRole("button", { name: fixture.back, exact: true }).click();
		await expect(page.locator("#diagnostic-stage-title")).toBeFocused();
		await expect(page.getByLabel(fixture.website, { exact: true })).toHaveValue("https://acme.example");
		await expect(page.getByLabel(fixture.brand, { exact: true })).toHaveValue("Acme");
		await expect(page.getByLabel(fixture.market, { exact: true })).toHaveValue("Enterprise software");
		await expect(page.getByLabel(fixture.question, { exact: true })).toHaveValue(
			"Which platform should a global team choose?",
		);
		await page.getByRole("button", { name: fixture.continue, exact: true }).click();
		await expect(page.getByLabel(fixture.competitors, { exact: true })).toHaveValue("Example Co");
		await expect(page.getByLabel(fixture.name, { exact: true })).toHaveValue("Ava Chen");
		await expect(page.getByLabel(fixture.email, { exact: true })).toHaveValue("ava@acme.example");
		await expect(page.getByLabel(fixture.consent)).toBeChecked();
	});

	test(`${fixture.route} keeps Privacy directly beside consent without nesting the link`, async ({ page }) => {
		await openScope(page, fixture);
		await completeScope(page, fixture);

		const consent = page.locator(".diagnostic-consent");
		const privacy = page.locator(".diagnostic-privacy");
		await expect(consent).toBeVisible();
		await expect(privacy).toBeVisible();
		expect(
			await consent.evaluate(
				(element) =>
					element === element.parentElement?.lastElementChild &&
					element.parentElement?.nextElementSibling?.classList.contains("diagnostic-privacy"),
			),
		).toBe(true);
		await expect(consent.locator("a[href='/privacy']")).toHaveCount(0);
		await expect(privacy.locator("a[href='/privacy']")).not.toHaveAttribute("target", "_blank");
	});

	test(`${fixture.route} preserves textarea newlines while Enter advances and submits from other fields`, async ({ page }) => {
		let requests = 0;
		await page.route("**/api/diagnostic", async (route) => {
			requests += 1;
			await fulfillJson(route, 503, '{"ok":false,"code":"delivery_unconfirmed"}');
		});
		await openScope(page, fixture);
		await page.getByLabel(fixture.brand, { exact: true }).fill("Acme");
		await page.getByLabel(fixture.market, { exact: true }).fill("Enterprise software");
		const question = page.getByLabel(fixture.question, { exact: true });
		await question.fill("Which platform should a global team choose?");
		await question.press("Enter");
		await expect(question).toHaveValue("Which platform should a global team choose?\n");
		await page.getByLabel(fixture.market, { exact: true }).press("Enter");
		await expect(page.locator(".diagnostic-sheet__masthead li").filter({ hasText: fixture.contactProgress })).toHaveAttribute(
			"aria-current",
			"step",
		);
		await completeContact(page, fixture);
		await page.getByLabel(fixture.email, { exact: true }).press("Enter");
		await expect(page.getByRole("alert")).toContainText(fixture.failure);
		expect(requests).toBe(1);
	});
}

for (const fixture of locales) {
	test(`${fixture.route} uses one UUID, locks double submits, and succeeds only after 202 ok`, async ({ page }) => {
		let requestCount = 0;
		let requestHeader = "";
		let release: (() => Promise<void>) | undefined;
		await page.route("**/api/diagnostic", (route) => {
			requestCount += 1;
			requestHeader = route.request().headers()["idempotency-key"] ?? "";
			return new Promise<void>((resolve) => {
				release = async () => {
					await fulfillJson(route, 202, '{"ok":true}');
					resolve();
				};
			});
		});
		await completeDiagnostic(page, fixture);
		const submit = page.getByRole("button", { name: fixture.submit, exact: true });
		await submit.evaluate((button) => {
			const form = button.closest("form");
			if (!form) throw new Error("Missing diagnostic form");
			form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
			form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
		});

		await expect(page.getByRole("status")).toContainText(fixture.submitting);
		await expect(page.locator(".diagnostic-action--primary")).toBeDisabled();
		await expect(page.getByRole("button", { name: fixture.back, exact: true })).toBeDisabled();
		await expect.poll(() => requestCount).toBe(1);
		expect(requestHeader).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		await release?.();
		await expect(page.getByRole("status")).toContainText(fixture.success);
		await expectVisibleProgrammaticFocus(page.locator("#diagnostic-success-title"), `${fixture.route} success heading`);
	});

	for (const response of [
		{ name: "invalid 202", status: 202, body: "not json" },
		{ name: "explicit 503", status: 503, body: '{"ok":false,"code":"delivery_unconfirmed"}' },
	]) {
		test(`${fixture.route} ${response.name} keeps values and exposes the complete mail draft`, async ({ page }) => {
			await page.route("**/api/diagnostic", (route) => fulfillJson(route, response.status, response.body));
			await completeDiagnostic(page, fixture);
			await page.getByRole("button", { name: fixture.submit, exact: true }).click();

			await expect(page.getByRole("alert")).toContainText(fixture.failure);
			await expect(page.getByLabel(fixture.name, { exact: true })).toHaveValue("Ava Chen");
			await expectCompleteMailDraft(page, fixture);
		});
	}

	test(`${fixture.route} network ambiguity remains unconfirmed without losing values`, async ({ page }) => {
		await page.route("**/api/diagnostic", (route) => route.abort("timedout"));
		await completeDiagnostic(page, fixture);
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();

		await expect(page.getByRole("alert")).toContainText(fixture.failure);
		await expect(page.getByLabel(fixture.name, { exact: true })).toHaveValue("Ava Chen");
		await expectCompleteMailDraft(page, fixture);
	});

	test(`${fixture.route} client timeout remains unconfirmed with values and the complete mail draft`, async ({ page }) => {
		test.setTimeout(30_000);
		let requestSeen = false;
		await page.route("**/api/diagnostic", async (route) => {
			requestSeen = true;
			await new Promise((resolve) => setTimeout(resolve, 12_000));
			await fulfillJson(route, 202, '{"ok":true}').catch(() => undefined);
		});
		await completeDiagnostic(page, fixture);
		const startedAt = Date.now();
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();

		await expect(page.getByRole("status")).toContainText(fixture.submitting);
		await expect(page.getByRole("alert")).toContainText(fixture.failure, { timeout: 15_000 });
		expect(requestSeen).toBe(true);
		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(9_000);
		await expect(page.getByLabel(fixture.name, { exact: true })).toHaveValue("Ava Chen");
		await expectCompleteMailDraft(page, fixture);
	});

	test(`${fixture.route} retry reuses a normalized lead UUID and rotates it after a material edit`, async ({ page }) => {
		const keys: string[] = [];
		await page.route("**/api/diagnostic", async (route) => {
			keys.push(route.request().headers()["idempotency-key"] ?? "");
			await fulfillJson(route, 503, '{"ok":false,"code":"delivery_unconfirmed"}');
		});
		await completeDiagnostic(page, fixture);
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await expect(page.getByRole("alert")).toBeVisible();

		await page.getByRole("button", { name: fixture.back, exact: true }).click();
		const brand = page.getByLabel(fixture.brand, { exact: true });
		await brand.fill("Temporary");
		await brand.fill("Acme");
		await page.getByLabel(fixture.market, { exact: true }).fill("  Enterprise software  ");
		await page.getByRole("button", { name: fixture.continue, exact: true }).click();
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await expect.poll(() => keys.length).toBe(2);
		expect(keys[1]).toBe(keys[0]);

		await page.getByRole("button", { name: fixture.back, exact: true }).click();
		await brand.fill("Acme Labs");
		await page.getByRole("button", { name: fixture.continue, exact: true }).click();
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await expect.poll(() => keys.length).toBe(3);
		expect(keys[2]).not.toBe(keys[1]);
	});

	test(`${fixture.route} materially edited lead cannot be replaced by a stale success`, async ({ page }) => {
		let release: (() => Promise<void>) | undefined;
		await page.route("**/api/diagnostic", (route) =>
			new Promise<void>((resolve) => {
				release = async () => {
					await fulfillJson(route, 202, '{"ok":true}');
					resolve();
				};
			}),
		);
		await completeDiagnostic(page, fixture);
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await expect(page.getByRole("status")).toContainText(fixture.submitting);
		await page.getByLabel(fixture.name, { exact: true }).fill("Ava Li");
		await release?.();

		await expect(page.getByText(fixture.success, { exact: true })).toHaveCount(0);
		await expect(page.getByLabel(fixture.name, { exact: true })).toHaveValue("Ava Li");
	});

	test(`${fixture.route} unmount aborts a pending request without leaking a result`, async ({ page }) => {
		let release: (() => Promise<void>) | undefined;
		await page.route("**/api/diagnostic", (route) =>
			new Promise<void>((resolve) => {
				release = async () => {
					await fulfillJson(route, 202, '{"ok":true}');
					resolve();
				};
			}),
		);
		await completeDiagnostic(page, fixture);
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await page.goto("/product");
		await release?.();
		await expect(page.getByRole("heading", { level: 1, name: "Make AI market answers observable." })).toBeVisible();
		await expect(page.getByText(fixture.success, { exact: true })).toHaveCount(0);
	});
}

test("Scope Desk keeps one square Paper sheet and switches to authored mobile order", async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 768 });
	await openScope(page, locales[0]);
	const intro = page.locator(".diagnostic-intro");
	const output = page.locator(".diagnostic-output");
	const sheet = page.locator(".diagnostic-sheet");
	const [introBox, outputBox, sheetBox] = await Promise.all([intro.boundingBox(), output.boundingBox(), sheet.boundingBox()]);
	expect(sheetBox?.x ?? 0).toBeGreaterThan((introBox?.x ?? 0) + (introBox?.width ?? 0));
	expect(Math.abs((introBox?.x ?? 0) - (outputBox?.x ?? 0))).toBeLessThanOrEqual(2);
	const sheetStyle = await sheet.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			background: style.backgroundColor,
			backgroundImage: style.backgroundImage,
			borderRadius: style.borderRadius,
			boxShadow: style.boxShadow,
		};
	});
	expect(sheetStyle).toEqual({
		background: "rgb(246, 244, 241)",
		backgroundImage: "none",
		borderRadius: "0px",
		boxShadow: "none",
	});
	await expect(page.locator(".diagnostic-desk svg, .diagnostic-desk canvas")).toHaveCount(0);

	await page.setViewportSize({ width: 768, height: 1024 });
	await openScope(page, locales[0]);
	const [mobileIntro, mobileOutput, mobileSheet] = await Promise.all([
		intro.boundingBox(),
		output.boundingBox(),
		sheet.boundingBox(),
	]);
	expect(mobileOutput?.y ?? 0).toBeGreaterThan((mobileIntro?.y ?? 0) + (mobileIntro?.height ?? 0));
	expect(mobileSheet?.y ?? 0).toBeGreaterThan((mobileOutput?.y ?? 0) + (mobileOutput?.height ?? 0));
});

test("diagnostic controls expose 44px targets and Signal focus", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.mobile);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openScope(page, locales[0]);
	const website = page.getByLabel(locales[0].website, { exact: true });
	await website.focus();
	expect(await website.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
	await website.blur();
	for (const control of [
		website,
		page.getByRole("button", { name: locales[0].continue, exact: true }),
	]) {
		const box = await control.boundingBox();
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
	}
	await expectSignalFocusVisible(page, website);
	await expectSignalFocusVisible(page, page.getByRole("button", { name: locales[0].continue, exact: true }));
});

test("Chinese semantic headline lines stay intact across conversion widths", async ({ page }) => {
	for (const width of [1440, 1024, 768, 390, 360, 320, 280]) {
		await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
		await openScope(page, locales[1]);
		for (const phrase of ["先看见 AI 看见了什么", "再决定改变什么"]) {
			const line = page.locator(`[data-diagnostic-headline-line="${phrase}"]`);
			await expect(line).toBeVisible();
			const rects = await line.evaluate((element) => [...element.getClientRects()].length);
			expect(rects, `${phrase} should remain one semantic line at ${width}px`).toBe(1);
		}
	}
});

const qaWidths = [1440, 1024, 768, 390, 360, 320, 280] as const;
for (const fixture of locales) {
	test(`${fixture.route} is accessible and overflow-free in every state at all seven widths`, async ({ page }) => {
		test.setTimeout(360_000);
		for (const width of qaWidths) {
			await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
			await page.emulateMedia({ reducedMotion: "reduce" });
			await openScope(page, fixture);
			await expectNoHorizontalOverflow(page);
			await expectMinimumTarget(page.getByLabel(fixture.website, { exact: true }), `scope website at ${width}px`);
			await expectSignalFocusFromCleanState(page, page.getByLabel(fixture.website, { exact: true }));
			await expectNoRunningAnimations(page);
			await runWcagAa(page);

			await completeScope(page, fixture);
			await expectVisibleProgrammaticFocus(
				page.locator("#diagnostic-stage-title"),
				`contact heading at ${width}px`,
			);
			await expectNoHorizontalOverflow(page);
			await expectMinimumTarget(
				page.getByRole("button", { name: fixture.back, exact: true }),
				`contact Back at ${width}px`,
			);
			await expectMinimumTarget(page.locator(".diagnostic-consent label"), `contact consent at ${width}px`);
			await expectSignalFocusFromCleanState(page, page.getByRole("button", { name: fixture.back, exact: true }));
			await expectNoRunningAnimations(page);
			await runWcagAa(page);
			await completeContact(page, fixture);
			await expect(page.getByLabel(fixture.competitors, { exact: true }), `competitors at ${width}px`).toHaveValue(
				"Example Co",
			);
			await expect(page.getByLabel(fixture.name, { exact: true }), `name at ${width}px`).toHaveValue("Ava Chen");
			await expect(page.getByLabel(fixture.email, { exact: true }), `email at ${width}px`).toHaveValue(
				"ava@acme.example",
			);

			let release: (() => Promise<void>) | undefined;
			await page.route("**/api/diagnostic", (route) =>
				new Promise<void>((resolve) => {
					release = async () => {
						await fulfillJson(route, 202, '{"ok":true}');
						resolve();
					};
				}),
			);
			await page.getByRole("button", { name: fixture.submit, exact: true }).click();
			await expect(page.getByRole("status")).toContainText(fixture.submitting);
			await expectNoHorizontalOverflow(page);
			await expectMinimumTarget(page.getByLabel(fixture.name, { exact: true }), `pending name at ${width}px`);
			await expectSignalFocusFromCleanState(page, page.getByLabel(fixture.name, { exact: true }));
			await expectNoRunningAnimations(page);
			await runWcagAa(page);
			await release?.();
			await expect(page.getByRole("status")).toContainText(fixture.success);
			await expectVisibleProgrammaticFocus(
				page.locator("#diagnostic-success-title"),
				`success heading at ${width}px`,
			);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
			await expectNoRunningAnimations(page);

			await page.unrouteAll({ behavior: "wait" });
			await page.route("**/api/diagnostic", (route) =>
				fulfillJson(route, 503, '{"ok":false,"code":"delivery_unconfirmed"}'),
			);
			await completeDiagnostic(page, fixture);
			await expect(page.getByLabel(fixture.name, { exact: true }), `failure name at ${width}px`).toHaveValue("Ava Chen");
			await page.getByRole("button", { name: fixture.submit, exact: true }).click();
			await expect(page.getByRole("alert")).toContainText(fixture.failure);
			await expectVisibleProgrammaticFocus(page.locator(".diagnostic-failure"), `unconfirmed alert at ${width}px`);
			await expectNoHorizontalOverflow(page);
			await expectMinimumTarget(
				page.getByRole("link", { name: fixture.fallback, exact: true }),
				`unconfirmed email draft at ${width}px`,
			);
			await expectMinimumTarget(
				page.getByRole("button", { name: fixture.retry, exact: true }),
				`unconfirmed Retry at ${width}px`,
			);
			await expectSignalFocusFromCleanState(page, page.getByRole("button", { name: fixture.retry, exact: true }));
			await expectNoRunningAnimations(page);
			await runWcagAa(page);
			await page.unrouteAll({ behavior: "wait" });
		}
	});

	test(`${fixture.route} leaves no running motion with reduced motion`, async ({ page }) => {
		await expectNoRunningAnimations(page, fixture.route);
	});
}

const visualViewports = ["desktop", "mobile", "narrow"] as const;
const visualStates = ["scope", "contact", "success", "unconfirmed"] as const;
for (const fixture of locales) {
	for (const viewport of visualViewports) {
		for (const state of visualStates) {
			test(`${fixture.locale} ${viewport} ${state} diagnostic visual evidence`, { tag: "@visual" }, async ({ page }) => {
				await page.setViewportSize(QA_VIEWPORTS[viewport]);
				if (state === "scope") {
					await openScope(page, fixture);
				} else {
					await openScope(page, fixture);
					await completeScope(page, fixture);
					if (state === "success" || state === "unconfirmed") {
						await completeContact(page, fixture);
						await page.route("**/api/diagnostic", (route) =>
							state === "success"
								? fulfillJson(route, 202, '{"ok":true}')
								: fulfillJson(route, 503, '{"ok":false,"code":"delivery_unconfirmed"}'),
						);
						await page.getByRole("button", { name: fixture.submit, exact: true }).click();
						await expect(state === "success" ? page.getByRole("status") : page.getByRole("alert")).toBeVisible();
					}
				}
				await page.addStyleTag({ content: ".site-header { position: static !important; }" });
				await page.evaluate(() => window.scrollTo(0, 0));
				await captureQa(page, { locale: fixture.locale, route: fixture.route, viewport, state });
			});
		}
	}
}

test("both diagnostic locales link the same canonical privacy disclosure", async ({ page }) => {
	for (const fixture of locales) {
		await openScope(page, fixture);
		await completeScope(page, fixture);
		const privacy = page.locator(".diagnostic-privacy a");
		await expect(privacy).toHaveAttribute("href", "/privacy");
		await expect(privacy).not.toHaveAttribute("target", "_blank");
		await privacy.click();
		await expect(page).toHaveURL(/\/privacy$/);
		await expect(page.getByRole("heading", { level: 1, name: /Privacy \/ 隐私说明/ })).toBeVisible();
	}
});

test("privacy disclosure publishes both languages under one canonical route", async ({ page }) => {
	await page.goto("/privacy");
	await waitForHydration(page);

	await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
	await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", "/privacy");
	await expect(page.locator('head link[rel="alternate"]')).toHaveCount(0);
	await expect(page.locator("#privacy-en")).toHaveAttribute("lang", "en");
	await expect(page.locator("#privacy-zh")).toHaveAttribute("lang", "zh-CN");
	await expect(page.locator("#privacy-en h2")).toHaveText("How we handle diagnostic request data");
	await expect(page.locator("#privacy-zh h2")).toHaveText("我们如何处理诊断申请信息");
	await expect(page.getByRole("link", { name: "Return to the diagnostic", exact: true })).toHaveAttribute(
		"href",
		"/diagnostic",
	);
	await expect(page.getByRole("link", { name: "返回诊断申请", exact: true })).toHaveAttribute(
		"href",
		"/zh/diagnostic",
	);
	await expect(page.getByRole("link", { name: "black.dcp@outlook.com", exact: true })).toHaveCount(2);

	const ids = await page.locator("[id]").evaluateAll((elements) => elements.map((element) => element.id));
	expect(new Set(ids).size).toBe(ids.length);

	const missing = await page.goto("/zh/privacy");
	expect(missing?.status()).toBe(404);
});

test("privacy disclosure stays accessible and usable at all seven acceptance widths", async ({ page }) => {
	test.setTimeout(180_000);
	for (const width of qaWidths) {
		await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/privacy");
		await waitForHydration(page);

		await expect(page.locator("main")).toHaveCount(1);
		await expect(page.locator("body > div .site-header")).toHaveCount(1);
		await expect(page.locator("body > div .site-footer")).toHaveCount(1);
		await expect(page.locator("#privacy-zh h2")).toHaveText("我们如何处理诊断申请信息");
		await expectNoHorizontalOverflow(page);
		await expectNoRunningAnimations(page);
		await runWcagAa(page);

		const englishJump = page.locator('.privacy-jump a[href="#privacy-en"]');
		const chineseJump = page.locator('.privacy-jump a[href="#privacy-zh"]');
		await expectMinimumTarget(englishJump, `English privacy jump at ${width}px`);
		await expectMinimumTarget(chineseJump, `Chinese privacy jump at ${width}px`);
		await expectSignalFocusFromCleanState(page, englishJump);
		await expectSignalFocusFromCleanState(page, chineseJump);
		await chineseJump.focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/#privacy-zh$/);
		const chineseDisclosure = page.locator("#privacy-zh");
		await expect(chineseDisclosure).toBeFocused();
		await expect(chineseDisclosure).toBeInViewport();
		const targetFocus = await chineseDisclosure.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				outlineColor: style.outlineColor,
				outlineStyle: style.outlineStyle,
				outlineWidth: style.outlineWidth,
			};
		});
		expect(targetFocus.outlineStyle).not.toBe("none");
		expect(Number.parseFloat(targetFocus.outlineWidth)).toBeGreaterThanOrEqual(2);
		expect(targetFocus.outlineColor).toBe("rgb(255, 106, 0)");
	}
});

test("privacy disclosure keeps the Chinese contact address and closing punctuation on one line at 280px", async ({
	page,
}) => {
	await page.setViewportSize({ width: 280, height: 720 });
	await page.goto("/privacy");
	await waitForHydration(page);

	const lineMetrics = await page.locator("#privacy-zh-contact .privacy-fact__body p").evaluate((paragraph) => {
		const address = paragraph.querySelector("a");
		const punctuation = address?.nextSibling;
		const addressText = address?.firstChild;
		if (!(addressText instanceof Text) || !(punctuation instanceof Text)) {
			throw new Error("Expected the contact address followed by its closing punctuation");
		}
		const addressRange = document.createRange();
		addressRange.selectNodeContents(addressText);
		const punctuationRange = document.createRange();
		punctuationRange.selectNodeContents(punctuation);
		return {
			addressBottom: addressRange.getBoundingClientRect().bottom,
			punctuationBottom: punctuationRange.getBoundingClientRect().bottom,
		};
	});

	expect(Math.abs(lineMetrics.addressBottom - lineMetrics.punctuationBottom)).toBeLessThanOrEqual(1);
});

for (const viewport of [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "mobile", width: 390, height: 844 },
	{ name: "minimum", width: 280, height: 720 },
] as const) {
	test(`privacy ${viewport.name} visual evidence`, { tag: "@visual" }, async ({ page }, testInfo) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/privacy");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1, name: "Privacy / 隐私说明", exact: true })).toBeVisible();
		await page.addStyleTag({ content: ".site-header { position: static !important; }" });
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			animations: "disabled",
			caret: "hide",
			fullPage: true,
			path: testInfo.outputPath(`privacy-${viewport.width}.png`),
		});
	});
}
