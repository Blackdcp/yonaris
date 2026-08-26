import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MessageId } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";
import { customerSettingsErrorMessageId } from "./customer-settings-errors";

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({ mutate: vi.fn(), isSuccess: false }),
	useQuery: () => ({ data: undefined }),
	useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate: vi.fn() }) }));
vi.mock("@/hooks/use-brands", () => ({
	brandKeys: { all: ["brands"] },
	useBrand: () => ({ brand: undefined }),
}));
vi.mock("@/hooks/use-citations", () => ({ citationKeys: { all: ["citations"] } }));
vi.mock("@/hooks/use-dashboard-summary", () => ({ dashboardKeys: { all: ["dashboard"] } }));
vi.mock("@/hooks/use-prompts-summary", () => ({ promptsSummaryKeys: { all: ["prompts-summary"] } }));
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/server/onboarding", () => ({
	cancelAnalyzeBrandFn: vi.fn(),
	getAnalyzeBrandStatusFn: vi.fn(),
	startAnalyzeBrandFn: vi.fn(),
	updateOnboardedBrandFn: vi.fn(),
}));

import type { CompetitorEntry } from "./competitors-editor";
import * as PromptWizardModule from "./prompt-wizard";
import type { EditablePrompt } from "./prompts-list-editor";

type WizardData = {
	brandName: string;
	website: string;
	additionalDomains: string[];
	aliases: string[];
	competitors: CompetitorEntry[];
	prompts: EditablePrompt[];
};

type WizardViewProps = {
	phase: "idle" | "analyzing" | "review";
	needsReanalysis: boolean;
	error: MessageId | null;
	submitError: MessageId | null;
	isSaving: boolean;
	websiteBeingAnalyzed: string;
	data: WizardData;
	onAnalyze: () => void;
	onCancel: () => void;
	onSubmit: () => void;
	onBrandNameChange: (value: string) => void;
	onWebsiteChange: (value: string) => void;
	onAdditionalDomainsChange: (values: string[]) => void;
	onAliasesChange: (values: string[]) => void;
	onCompetitorsChange: (values: CompetitorEntry[]) => void;
	onPromptsChange: (values: EditablePrompt[]) => void;
};

type BuildSubmission = (input: {
	brand: { id: string; name: string; website: string };
	data: WizardData;
	needsReanalysis: boolean;
}) =>
	| { ok: false; formError: MessageId }
	| {
			ok: true;
			submitted: {
				brandId: string;
				brandName: string;
				website: string;
				additionalDomains: string[];
				aliases: string[];
				competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
				prompts: Array<{ value: string; tags: string[]; enabled: true }>;
			};
	  };

const rawData: WizardData = {
	brandName: "StepFun 原名",
	website: "https://evidence.example.cn/path?q=CN",
	additionalDomains: ["docs.example.cn"],
	aliases: ["Step 原始别名"],
	competitors: [
		{
			_key: "competitor-key",
			name: "DeepSeek 原名",
			domains: ["deepseek.example.cn"],
			aliases: ["DS-R1"],
			expanded: false,
		},
	],
	prompts: [
		{
			_key: "prompt-key",
			value: "Which AI IDE works in 中国?",
			enabled: true,
			tags: ["Buyer-Journey"],
			systemTags: ["unbranded"],
		},
	],
};

function renderWithLocale(locale: UiLanguage, children: ReactNode) {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

function view(overrides: Partial<WizardViewProps> = {}) {
	const PromptWizardView = (
		PromptWizardModule as unknown as { PromptWizardView?: React.ComponentType<WizardViewProps> }
	).PromptWizardView;
	expect(PromptWizardView).toBeTypeOf("function");
	if (!PromptWizardView) throw new Error("PromptWizardView is required");
	return (
		<PromptWizardView
			phase="idle"
			needsReanalysis={false}
			error={null}
			submitError={null}
			isSaving={false}
			websiteBeingAnalyzed="https://evidence.example.cn/path?q=CN"
			data={rawData}
			onAnalyze={vi.fn()}
			onCancel={vi.fn()}
			onSubmit={vi.fn()}
			onBrandNameChange={vi.fn()}
			onWebsiteChange={vi.fn()}
			onAdditionalDomainsChange={vi.fn()}
			onAliasesChange={vi.fn()}
			onCompetitorsChange={vi.fn()}
			onPromptsChange={vi.fn()}
			{...overrides}
		/>
	);
}

function getBuildSubmission(): BuildSubmission {
	const build = (PromptWizardModule as unknown as { buildPromptWizardSubmission?: BuildSubmission })
		.buildPromptWizardSubmission;
	expect(build).toBeTypeOf("function");
	return build as BuildSubmission;
}

describe("Prompt Wizard localization and submission boundary", () => {
	it("renders Chinese initial, pending, and safe generic failure states with the raw website unchanged", () => {
		const initial = renderWithLocale("zh-CN", view());
		const pending = renderWithLocale("zh-CN", view({ phase: "analyzing" }));
		const failure = renderWithLocale("zh-CN", view({ error: "common.error.unexpected" }));

		expect(initial).toContain("https://evidence.example.cn/path?q=CN");
		expect(initial).toContain("分析品牌");
		expect(pending).toContain("正在分析品牌…");
		expect(pending).toContain("取消");
		expect(failure).toContain("出现了问题，请重试。");
		expect(failure).not.toContain("worker SQL host and stack detail");
		expect(initial).not.toContain("Analyze brand");
	});

	it("renders every Chinese review, reanalysis, validation, pending-save, and accessibility state without translating data", () => {
		const review = renderWithLocale("zh-CN", view({ phase: "review" }));
		const reanalysis = renderWithLocale("zh-CN", view({ phase: "review", needsReanalysis: true }));
		const validation = renderWithLocale(
			"zh-CN",
			view({ phase: "review", submitError: "customer.onboardingWizard.validation.promptRequired" as MessageId }),
		);
		const saving = renderWithLocale("zh-CN", view({ phase: "review", isSaving: true }));

		expect(review).toContain("品牌详情");
		expect(review).toContain("确认用于追踪的品牌标识、其他域名和别名。");
		expect(review).toContain('aria-label="品牌名称"');
		expect(review).toContain('aria-label="网站网址"');
		expect(review).toContain("StepFun 原名");
		expect(review).toContain("https://evidence.example.cn/path?q=CN");
		expect(review).toContain("docs.example.cn");
		expect(review).toContain("Step 原始别名");
		expect(review).toContain("DeepSeek 原名");
		expect(review).toContain("Which AI IDE works in 中国?");
		expect(review).toContain("开始追踪（1 个新提示词）");
		expect(reanalysis).toContain("品牌详情已更改");
		expect(reanalysis).toContain("重新分析品牌");
		expect(validation).toContain("请至少选择或添加一个已启用的提示词，再开始追踪。");
		expect(saving).toContain("正在保存…");
		expect(review).not.toContain("Brand details");
	});

	it.each(["en", "zh-CN"] as const)(
		"builds the exact save payload and returns typed validation without rewriting values in %s",
		(locale) => {
			const build = getBuildSubmission();
			const markup = renderWithLocale(locale, view({ phase: "review" }));
			const result = build({
				brand: { id: "brand-raw-id", name: "Stored Brand 原名", website: "https://stored.example.cn" },
				data: rawData,
				needsReanalysis: false,
			});
			const invalid = build({
				brand: { id: "brand-raw-id", name: "Stored Brand 原名", website: "https://stored.example.cn" },
				data: { ...rawData, prompts: [] },
				needsReanalysis: false,
			});

			expect(markup).toContain("StepFun 原名");
			expect(markup).toContain("Which AI IDE works in 中国?");
			expect(result).toEqual({
				ok: true,
				submitted: {
					brandId: "brand-raw-id",
					brandName: "StepFun 原名",
					website: "https://evidence.example.cn/path?q=CN",
					additionalDomains: ["docs.example.cn"],
					aliases: ["Step 原始别名"],
					competitors: [{ name: "DeepSeek 原名", domains: ["deepseek.example.cn"], aliases: ["DS-R1"] }],
					prompts: [{ value: "Which AI IDE works in 中国?", tags: ["Buyer-Journey"], enabled: true }],
				},
			});
			expect(invalid).toEqual({
				ok: false,
				formError: "customer.onboardingWizard.validation.promptRequired",
			});
		},
	);

	it("recognizes only bounded Wizard failures and hides every arbitrary exception", () => {
		const map = customerSettingsErrorMessageId as unknown as (operation: string, error: unknown) => MessageId;

		expect(map("wizardAnalyze", new Error("Forbidden: Platform administrator access required"))).toBe(
			"customer.onboardingWizard.error.notAllowed",
		);
		expect(map("wizardStatus", new Error("Brand analysis failed. Please try again."))).toBe(
			"customer.onboardingWizard.error.analysisFailed",
		);
		expect(map("wizardSave", new Error("Website URL must use http or https"))).toBe(
			"customer.onboardingWizard.validation.websiteInvalid",
		);
		const analyzeUnknown = map("wizardAnalyze", new Error("provider key and stack detail"));
		const statusUnknown = map("wizardStatus", { message: "worker SQL host and stack detail" });
		const saveUnknown = map("wizardSave", new Error("database row and stack detail"));
		const analyzeFailure = renderWithLocale("zh-CN", view({ error: analyzeUnknown }));
		const statusFailure = renderWithLocale("zh-CN", view({ error: statusUnknown }));
		const saveFailure = renderWithLocale("zh-CN", view({ phase: "review", submitError: saveUnknown }));

		expect(analyzeUnknown).toBe("common.error.unexpected");
		expect(statusUnknown).toBe("common.error.unexpected");
		expect(saveUnknown).toBe("common.error.unexpected");
		expect(analyzeFailure).not.toContain("provider key and stack detail");
		expect(statusFailure).not.toContain("worker SQL host and stack detail");
		expect(saveFailure).not.toContain("database row and stack detail");
	});
});
