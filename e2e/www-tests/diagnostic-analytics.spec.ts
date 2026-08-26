import { expect, test, type Page, type Request } from "@playwright/test";
import { gunzipSync } from "node:zlib";

const posthogToken = "phc_diagnostic_privacy_test";
const rawPrefill = "https://acme.example/private-path";
const localeCases = [
	{
		locale: "en" as const,
		path: "/diagnostic",
		name: { label: "Name", value: "Ava Chen" },
		contact: { label: "Work email", value: "ava@acme.example" },
		company: { label: "Company", value: "Acme Confidential" },
		submit: "Talk to Yonaris",
		failure: "Delivery is not confirmed.",
	},
	{
		locale: "zh" as const,
		path: "/zh/diagnostic",
		name: { label: "姓名", value: "陈晓" },
		contact: { label: "电话", value: "+86 138 0013 8000" },
		company: { label: "公司", value: "示例机密公司" },
		submit: "提交并预约沟通",
		failure: "投递尚未确认",
	},
] as const;
const sensitiveValues = [
	rawPrefill,
	...localeCases.flatMap(({ name, contact, company }) => [name.value, contact.value, company.value]),
];

type PostHogCompression = "base64" | "gzip-js";

function isPostHogCapture(request: Request): boolean {
	const pathname = new URL(request.url()).pathname;
	return request.method() === "POST" && /\/test-posthog\/(?:e|batch)\/?$/u.test(pathname);
}

function decodeAnalyticsBody(request: Request): string {
	const url = new URL(request.url());
	const body = request.postDataBuffer() ?? Buffer.alloc(0);
	const compression = url.searchParams.get("compression");

	if (compression === "base64") {
		const raw = body.toString("utf8");
		const encoded = new URLSearchParams(raw).get("data") ?? raw;
		if (!encoded) return "";
		return Buffer.from(encoded, "base64").toString("utf8");
	}

	const contentEncoding = request.headers()["content-encoding"]?.toLowerCase();
	const hasGzipMagic = body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b;
	if (compression === "gzip-js" || contentEncoding?.includes("gzip") || hasGzipMagic) {
		return gunzipSync(body).toString("utf8");
	}

	return body.toString("utf8");
}

function observedAnalyticsRequest(request: Request): string {
	return [request.url(), decodeAnalyticsBody(request), JSON.stringify(request.headers())].join("\n");
}

async function installPostHogRemoteConfig(page: Page, compression: PostHogCompression): Promise<void> {
	await page.addInitScript(
		({ compression, token }) => {
			Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => undefined });
			Object.defineProperty(navigator, "userAgentData", {
				configurable: true,
				get: () => ({ brands: [{ brand: "Google Chrome", version: "149" }], mobile: false, platform: "Windows" }),
			});
			(window as Window & { _POSTHOG_REMOTE_CONFIG?: Record<string, unknown> })._POSTHOG_REMOTE_CONFIG = {
				[token]: {
					config: {
						hasFeatureFlags: false,
						supportedCompression: [compression],
					},
				},
			};
		},
		{ compression, token: posthogToken },
	);
}

for (const compression of ["base64", "gzip-js"] as const) {
	for (const fixture of localeCases) {
		test(`${fixture.locale} lead data stays out of real ${compression} analytics captures and browser storage`, async ({
			page,
		}) => {
		const plausibleEvents: Request[] = [];
		const posthogRequests: Request[] = [];
		const posthogCaptures: Request[] = [];
		let diagnosticUuid = "";
		let diagnosticBody: unknown;

		await installPostHogRemoteConfig(page, compression);
		await page.route("**/api/plausible/js/script", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/javascript",
				body: `fetch('/api/plausible/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'pageview', url: location.href, referrer: document.referrer }) });`,
			}),
		);
		await page.route("**/api/plausible/event", async (route) => {
			plausibleEvents.push(route.request());
			await route.fulfill({ status: 202, body: "ok" });
		});
		await page.route("**/test-posthog/**", async (route) => {
			posthogRequests.push(route.request());
			if (isPostHogCapture(route.request())) posthogCaptures.push(route.request());
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});
		await page.route("**/api/diagnostic", async (route) => {
			diagnosticUuid = route.request().headers()["idempotency-key"] ?? "";
			diagnosticBody = JSON.parse(route.request().postData() ?? "null");
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: '{"ok":false,"code":"delivery_unconfirmed"}',
			});
		});

		await page.goto(`${fixture.path}?website=${encodeURIComponent(rawPrefill)}&company=should-not-prefill`);
		await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
		await expect(page).toHaveURL(fixture.path);
		const form = page.locator("form.lead-form");
		await expect(form.locator("fieldset input")).toHaveCount(3);
		await page.getByLabel(fixture.name.label, { exact: true }).fill(fixture.name.value);
		await page.getByLabel(fixture.contact.label, { exact: true }).fill(fixture.contact.value);
		await page.getByLabel(fixture.company.label, { exact: true }).fill(fixture.company.value);
		await page.getByRole("button", { name: fixture.submit, exact: true }).click();
		await expect(page.getByRole("alert")).toContainText(fixture.failure);

		await expect.poll(() => plausibleEvents.length).toBeGreaterThan(0);
		await expect.poll(() => posthogCaptures.length).toBeGreaterThan(0);
		expect(diagnosticUuid).toMatch(/^[0-9a-f-]{36}$/);
		expect(diagnosticBody).toEqual(
			fixture.locale === "en"
				? {
						locale: "en",
						name: fixture.name.value,
						email: fixture.contact.value,
						company: fixture.company.value,
						companyUrl: "",
					}
				: {
						locale: "zh",
						name: fixture.name.value,
						phone: fixture.contact.value,
						company: fixture.company.value,
						companyUrl: "",
					},
		);
		const posthogPayloads = posthogCaptures.map(decodeAnalyticsBody).join("\n");
		expect(posthogPayloads).toContain('"event":"$pageview"');
		const analyticsTransport = [...plausibleEvents, ...posthogRequests]
			.map(observedAnalyticsRequest)
			.join("\n");
		expect(analyticsTransport).not.toContain("website=");
		for (const value of [...sensitiveValues, diagnosticUuid]) {
			expect(analyticsTransport).not.toContain(value);
			expect(analyticsTransport).not.toContain(encodeURIComponent(value));
		}

		const browserPersistence = await page.evaluate(() => ({
			cookie: document.cookie,
			localStorage: { ...localStorage },
			sessionStorage: { ...sessionStorage },
		}));
		const serializedPersistence = JSON.stringify(browserPersistence);
		for (const value of [...sensitiveValues, diagnosticUuid]) {
			expect(serializedPersistence).not.toContain(value);
			expect(serializedPersistence).not.toContain(encodeURIComponent(value));
		}
		});
	}
}
