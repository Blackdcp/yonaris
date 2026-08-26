import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	setUiLanguage: vi.fn(),
}));

vi.mock("@/server/ui-language", () => ({
	setUiLanguageFn: mocks.setUiLanguage,
}));

import { LanguageSwitcher, switchUiLanguage } from "./language-switcher";

describe("LanguageSwitcher", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it.each([
		["en", "true", "false"],
		["zh-CN", "false", "true"],
	] as const)("renders both choices and marks %s as current", (locale, englishChecked, chineseChecked) => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<LanguageSwitcher />
			</I18nProvider>,
		);

		expect(markup).toContain("English");
		expect(markup).toContain("简体中文");
		expect(markup).toContain(`data-language="en" aria-checked="${englishChecked}"`);
		expect(markup).toContain(`data-language="zh-CN" aria-checked="${chineseChecked}"`);
	});

	it.each(["en", "zh-CN"] as const)("writes only %s and reloads the unchanged URL", async (uiLanguage) => {
		const reload = vi.fn();
		const location = {
			href: "https://portal.example/auth/login?returnTo=%2Fapp%2Facme#help",
			pathname: "/auth/login",
			search: "?returnTo=%2Fapp%2Facme",
			hash: "#help",
			reload,
		};
		vi.stubGlobal("window", { location });

		await switchUiLanguage(uiLanguage);

		expect(mocks.setUiLanguage).toHaveBeenCalledOnce();
		expect(mocks.setUiLanguage).toHaveBeenCalledWith({ data: { uiLanguage } });
		expect(reload).toHaveBeenCalledOnce();
		expect(location).toMatchObject({
			pathname: "/auth/login",
			search: "?returnTo=%2Fapp%2Facme",
			hash: "#help",
		});
	});
});
