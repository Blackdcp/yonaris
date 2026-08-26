import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "./i18n/provider";

vi.mock("@sentry/tanstackstart-react", () => ({ captureException: vi.fn() }));
vi.mock("./components/full-page-card", () => ({
	default: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
		<main>
			<h1>{title}</h1>
			<p>{subtitle}</p>
		</main>
	),
}));

import { DefaultErrorComponent, NotFound } from "./router-default-components";

describe("router default components", () => {
	it.each([
		["en", "404 Not Found", "Something went wrong"],
		["zh-CN", "404 页面未找到", "出现了问题"],
	] as const)("renders global failures in %s", (locale, notFoundTitle, errorTitle) => {
		const notFound = renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<NotFound />
			</I18nProvider>,
		);
		const error = renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<DefaultErrorComponent error={new Error("private detail")} reset={vi.fn()} info={{ componentStack: "" }} />
			</I18nProvider>,
		);

		expect(notFound).toContain(notFoundTitle);
		expect(error).toContain(errorTitle);
		expect(error).not.toContain("private detail");
	});
});
