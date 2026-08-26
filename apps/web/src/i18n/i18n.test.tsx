import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatNumber, translate } from "./catalog";
import { I18nProvider, useI18n } from "./provider";

function WelcomeMessage() {
	const { t } = useI18n();
	return <p>{t("common.welcomeName", { name: "Acme" })}</p>;
}

function DefaultTimezoneDate() {
	const { formatDate } = useI18n();
	return (
		<time>{formatDate(new Date("2026-08-26T23:30:00Z"), { year: "numeric", month: "2-digit", day: "2-digit" })}</time>
	);
}

function LocalizedDocument({ locale }: { locale: "en" | "zh-CN" }) {
	return (
		<I18nProvider locale={locale}>
			<html lang={locale}>
				<head>
					<title>{translate(locale, "root.meta.title", { appName: "Yonaris" })}</title>
				</head>
				<body>
					<h1>{translate(locale, "auth.login.title")}</h1>
				</body>
			</html>
		</I18nProvider>
	);
}

describe("i18n catalog runtime", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});
	it("returns localized catalog messages", () => {
		expect(translate("zh-CN", "common.loading")).toBe("加载中…");
		expect(translate("zh-CN", "navigation.overview")).toBe("概览");
		expect(translate("zh-CN", "auth.login.title")).toBe("登录");
	});

	it("interpolates named values without modifying braces in values", () => {
		expect(translate("zh-CN", "common.welcomeName", { name: "Acme" })).toBe("欢迎，Acme");
		expect(translate("en", "common.welcomeName", { name: "A{cme}" })).toBe("Welcome, A{cme}");
	});

	it("throws for a missing interpolation value during development", () => {
		expect(() => translate("en", "common.welcomeName")).toThrow('Missing value for "name"');
	});

	it("uses a deliberate generic English fallback for a missing production interpolation value", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(translate("zh-CN", "common.welcomeName")).toBe("Something went wrong. Please try again.");
		expect(translate("zh-CN", "common.welcomeName")).not.toContain("{name}");
	});

	it("formats numbers and dates for the selected locale", () => {
		expect(formatNumber("zh-CN", 12345)).toBe("12,345");
		expect(formatDate("zh-CN", new Date("2026-08-26T00:00:00Z"), { timeZone: "UTC" })).toContain("2026");
	});

	it("defaults dates to UTC while allowing an explicit business timezone override", () => {
		const date = new Date("2026-08-26T23:30:00Z");
		const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

		expect(formatDate("en", date, options)).toBe("08/26/2026");
		expect(formatDate("en", date, { ...options, timeZone: "Asia/Shanghai" })).toBe("08/27/2026");
		expect(
			renderToStaticMarkup(
				<I18nProvider locale="en">
					<DefaultTimezoneDate />
				</I18nProvider>,
			),
		).toContain("08/26/2026");
	});

	it("renders translations through the React provider", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<WelcomeMessage />
			</I18nProvider>,
		);

		expect(markup).toContain("欢迎，Acme");
	});

	it.each([
		["en", "Yonaris - AI answer evidence", "Sign in"],
		["zh-CN", "Yonaris - AI 回答证据", "登录"],
	] as const)("keeps the %s document language and localized shell copy in agreement", (locale, title, loginTitle) => {
		const markup = renderToStaticMarkup(<LocalizedDocument locale={locale} />);

		expect(markup).toContain(`<html lang="${locale}">`);
		expect(markup).toContain(`<title>${title}</title>`);
		expect(markup).toContain(`<h1>${loginTitle}</h1>`);
	});
});
