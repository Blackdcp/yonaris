import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/components/full-page-card", () => ({
	default: ({ title, subtitle, children }: { title?: string; subtitle?: string; children?: ReactNode }) => (
		<main>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</main>
	),
}));

import MissingEnvPage from "./missing-env-page";

describe("MissingEnvPage", () => {
	it("does not render English registry descriptions in Chinese", () => {
		const englishDescription = "PostgreSQL connection string.";
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<MissingEnvPage
					mode="local"
					missing={[{ id: "DATABASE_URL", label: "DATABASE_URL", description: englishDescription }]}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("缺少环境配置");
		expect(markup).toContain("环境变量 DATABASE_URL 尚未配置。");
		expect(markup).not.toContain(englishDescription);
	});
});
