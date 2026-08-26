import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, translate } from "./catalog";
import { I18nProvider, useI18n } from "./provider";

function WelcomeMessage() {
	const { t } = useI18n();
	return <p>{t("common.welcomeName", { name: "Acme" })}</p>;
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

	it("formats numbers and dates for the selected locale", () => {
		expect(formatNumber("zh-CN", 12345)).toBe("12,345");
		expect(formatDate("zh-CN", new Date("2026-08-26T00:00:00Z"), { timeZone: "UTC" })).toContain("2026");
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
