import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { OpportunitiesGenerationControl, opportunityGenerationMessage } from "./opportunities-generation-control";

const harness = vi.hoisted(() => ({
	states: [] as unknown[],
	stateCursor: 0,
	buttons: [] as Array<{ disabled?: boolean; onClick?: () => void | Promise<void> }>,
	selection: {
		outputLanguage: "en" as "en" | "zh-CN",
		isResolved: true,
		setOutputLanguage: vi.fn(),
	},
	setQueryData: vi.fn(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useState<T>(initial: T | (() => T)) {
			const index = harness.stateCursor++;
			if (!(index in harness.states)) {
				harness.states[index] = typeof initial === "function" ? (initial as () => T)() : initial;
			}
			const setState = (next: T | ((previous: T) => T)) => {
				const previous = harness.states[index] as T;
				harness.states[index] = typeof next === "function" ? (next as (value: T) => T)(previous) : next;
			};
			return [harness.states[index] as T, setState] as const;
		},
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ setQueryData: harness.setQueryData }),
}));

vi.mock("@/hooks/use-artifact-language-selection", () => ({
	useArtifactLanguageSelection: () => harness.selection,
}));

vi.mock("@workspace/ui/components/button", () => ({
	Button: ({
		children,
		disabled,
		onClick,
	}: {
		children: ReactNode;
		disabled?: boolean;
		onClick?: () => void | Promise<void>;
	}) => {
		harness.buttons.push({ disabled, onClick });
		return (
			<button type="button" disabled={disabled}>
				{children}
			</button>
		);
	},
}));

const brands = [
	{
		id: "brand-provider-raw",
		name: "StepFun 原名",
		scopes: [
			{
				id: "scope-provider-raw",
				name: "China scored 原始",
				market: "CN",
				locale: "zh-CN",
				promptCount: 38,
			},
		],
	},
];

function renderControl(locale: "en" | "zh-CN", onGenerate = vi.fn()) {
	harness.stateCursor = 0;
	harness.buttons.length = 0;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<OpportunitiesGenerationControl brands={brands} onGenerate={onGenerate} />
		</I18nProvider>,
	);
}

describe("OpportunitiesGenerationControl", () => {
	beforeEach(() => {
		harness.states.length = 0;
		harness.stateCursor = 0;
		harness.buttons.length = 0;
		harness.selection.outputLanguage = "en";
		harness.selection.isResolved = true;
		harness.selection.setOutputLanguage.mockReset();
		harness.setQueryData.mockReset();
	});

	it("makes generation an explicit admin action for a brand and scope", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<OpportunitiesGenerationControl onGenerate={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain("Generate opportunities report");
		expect(markup).toContain("Brand");
		expect(markup).toContain("Program");
		expect(markup).toContain("<select");
		expect(markup).not.toContain("Measurement scope ID");
		expect(markup).not.toContain("Brand ID");
	});

	it("renders Chinese provider-tool controls while preserving brand, Program, market, and locale values", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<OpportunitiesGenerationControl
					onGenerate={vi.fn()}
					brands={[
						{
							id: "brand-provider-raw",
							name: "StepFun 原名",
							scopes: [
								{
									id: "scope-provider-raw",
									name: "China scored 原始",
									market: "CN",
									locale: "zh-CN",
									promptCount: 38,
								},
							],
						},
					]}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("生成优化机会报表");
		expect(markup).toContain("品牌");
		expect(markup).toContain("项目");
		expect(markup).toContain("选择品牌");
		expect(markup).toContain("选择项目");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain('value="brand-provider-raw"');
		expect(markup).not.toContain("Generate opportunities report");
	});

	it("labels the language selector from UI language while keeping exact language tokens", () => {
		const englishMarkup = renderControl("en");
		const chineseMarkup = renderControl("zh-CN");

		expect(englishMarkup).toContain('for="opportunities-output-language">Output language');
		expect(chineseMarkup).toContain('for="opportunities-output-language">输出语言');
		expect(englishMarkup).toContain(
			"This only sets the report content language. It does not change the Portal interface language.",
		);
		expect(chineseMarkup).toContain("仅决定本报告的内容语言，不会改变 Portal 界面语言。");
		expect(englishMarkup).toContain('aria-describedby="opportunities-output-language-help"');
		for (const markup of [englishMarkup, chineseMarkup]) {
			expect(markup).toMatch(/<option value="en"(?: selected="")?>English<\/option>/u);
			expect(markup).toMatch(/<option value="zh-CN"(?: selected="")?>简体中文<\/option>/u);
		}
	});

	it("submits and caches only the exact selected language variant", async () => {
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null);
		harness.selection.outputLanguage = "zh-CN";
		const result = {
			report: null,
			reason: "insufficient-data" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "zh-CN" as const,
		};
		const onGenerate = vi.fn(async () => result);

		renderControl("en", onGenerate);
		await harness.buttons.at(-1)?.onClick?.();

		expect(onGenerate).toHaveBeenCalledWith({
			brandId: "brand-provider-raw",
			scopeId: "scope-provider-raw",
			outputLanguage: "zh-CN",
		});
		expect(harness.setQueryData).toHaveBeenCalledOnce();
		expect(harness.setQueryData).toHaveBeenCalledWith(
			["opportunities-report", "brand-provider-raw", "scope-provider-raw", "zh-CN"],
			result,
		);
		expect(harness.setQueryData).not.toHaveBeenCalledWith(
			["opportunities-report", "brand-provider-raw", "scope-provider-raw", "en"],
			expect.anything(),
		);
	});

	it("does not overwrite a readable cached report when Chinese generation is temporarily unavailable", async () => {
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null);
		harness.selection.outputLanguage = "zh-CN";
		const onGenerate = vi.fn(async () => ({
			report: null,
			reason: "temporarily-unavailable" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "zh-CN" as const,
		}));

		renderControl("en", onGenerate);
		await harness.buttons.at(-1)?.onClick?.();

		expect(onGenerate).toHaveBeenCalledOnce();
		expect(harness.setQueryData).not.toHaveBeenCalled();
	});

	it("never caches a response under a differently selected language", async () => {
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null);
		harness.selection.outputLanguage = "en";
		const onGenerate = vi.fn(async () => ({
			report: null,
			reason: "not_generated" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "zh-CN" as const,
		}));

		renderControl("en", onGenerate);
		await harness.buttons.at(-1)?.onClick?.();

		expect(harness.setQueryData).not.toHaveBeenCalled();
	});

	it("does not enable generation before the per-key selection resolves", () => {
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null);
		harness.selection.isResolved = false;

		renderControl("en");

		expect(harness.buttons.at(-1)?.disabled).toBe(true);
	});
});

describe("opportunityGenerationMessage", () => {
	it("does not claim generation succeeded when the POST returns insufficient data", () => {
		expect(
			opportunityGenerationMessage({
				report: null,
				reason: "insufficient-data",
				generatedFor: null,
				lastEvaluatedAt: null,
				outputLanguage: "en",
			}),
		).toBe("No report was generated: this Program needs more tracking data.");
	});

	it("maps stable generation outcomes to Chinese without changing the response reason", () => {
		const result = {
			report: null,
			reason: "insufficient-data" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "en" as const,
		};

		expect(opportunityGenerationMessage(result, "zh-CN")).toBe("未生成报表：此项目需要更多追踪数据。");
		expect(result.reason).toBe("insufficient-data");
	});

	it("keeps temporary Chinese generation unavailability distinct from insufficient data", () => {
		expect(
			opportunityGenerationMessage(
				{
					report: null,
					reason: "temporarily-unavailable",
					generatedFor: null,
					lastEvaluatedAt: null,
					outputLanguage: "zh-CN",
				},
				"en",
			),
		).toBe("Simplified Chinese report generation is temporarily unavailable.");
	});
});
