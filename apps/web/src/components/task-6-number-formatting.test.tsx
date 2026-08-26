import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { ProgressBarChart } from "./progress-bar-chart";
import * as PromptsListEditorModule from "./prompts-list-editor";

vi.mock("@workspace/ui/components/tooltip", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
	TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
	TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

type PromptSelectionStatusProps = {
	selectedCount: number;
	onEnable: () => void;
	onDisable: () => void;
	onClear: () => void;
};

function renderWithLocale(locale: UiLanguage, children: ReactNode) {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

describe("Task 6 count formatting", () => {
	it("uses the active UI-language formatter for the reusable progress chart default", () => {
		const NativeNumberFormat = Intl.NumberFormat;
		const formatter = vi.spyOn(Intl, "NumberFormat").mockImplementation(function NumberFormat(locale, options) {
			return new NativeNumberFormat(locale, options);
		});

		const markup = renderWithLocale("zh-CN", <ProgressBarChart items={[{ label: "原始域名", count: 12345 }]} />);

		expect(formatter).toHaveBeenCalledWith("zh-CN", undefined);
		expect(markup).toContain("12,345");
		expect(markup).toContain("原始域名");
		formatter.mockRestore();
	});

	it("formats the real prompt bulk-selection count through the UI-language provider", () => {
		const PromptSelectionStatus = (
			PromptsListEditorModule as unknown as { PromptSelectionStatus?: React.ComponentType<PromptSelectionStatusProps> }
		).PromptSelectionStatus;
		expect(PromptSelectionStatus).toBeTypeOf("function");

		const markup = renderWithLocale(
			"zh-CN",
			PromptSelectionStatus ? (
				<PromptSelectionStatus selectedCount={12345} onEnable={vi.fn()} onDisable={vi.fn()} onClear={vi.fn()} />
			) : null,
		);

		expect(markup).toContain("已选择 12,345 个");
	});
});
