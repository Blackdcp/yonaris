import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	createBrand: vi.fn(),
	updatePrompts: vi.fn(),
	navigate: vi.fn(),
	invalidate: vi.fn(),
	invalidateSummary: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	useRouter: () => ({ invalidate: mocks.invalidate }),
}));
vi.mock("@/components/full-page-card", () => ({
	default: ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
		<main>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</main>
	),
}));
vi.mock("@/hooks/use-prompts-summary", () => ({
	useInvalidatePromptsSummary: () => mocks.invalidateSummary,
}));
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/server/brands", () => ({ createBrandFn: mocks.createBrand }));
vi.mock("@/server/prompts", () => ({ updatePromptsFn: mocks.updatePrompts }));

import * as BrandOnboardingModule from "./brand-onboarding";
import { CompetitorsEditor } from "./competitors-editor";
import * as PromptsEditorModule from "./prompts-editor";
import { PromptsListEditor } from "./prompts-list-editor";

type Mutation<T> = (input: { data: T }) => Promise<unknown>;

type SubmitBrandOnboardingForm = (
	formData: FormData,
	identity: { brandId: string; brandName: string },
	createBrand: Mutation<{ brandId: string; brandName: string; website: string }>,
) => Promise<
	| {
			ok: true;
			submitted: { brandId: string; brandName: string; website: string };
	  }
	| { ok: false; fieldErrors: { website?: MessageId }; formError?: MessageId }
>;

type SubmitPromptsForm = (
	input: {
		brandId: string;
		scopeId: string;
		initialPrompts: Array<{ id: string; value: string; enabled: boolean; tags?: string[] }>;
		prompts: Array<{
			id?: string;
			_key: string;
			value: string;
			enabled: boolean;
			tags: string[];
			systemTags: string[];
		}>;
	},
	updatePrompts: Mutation<{
		brandId: string;
		scopeId: string;
		prompts: Array<{ id?: string; value: string; enabled: boolean; tags: string[] }>;
	}>,
) => Promise<
	| {
			ok: true;
			submitted: {
				brandId: string;
				scopeId: string;
				prompts: Array<{ id?: string; value: string; enabled: boolean; tags: string[] }>;
			};
	  }
	| { ok: false; formError: MessageId }
>;

function getSubmitBrandOnboardingForm(): SubmitBrandOnboardingForm {
	const submit = (BrandOnboardingModule as unknown as { submitBrandOnboardingForm?: SubmitBrandOnboardingForm })
		.submitBrandOnboardingForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitBrandOnboardingForm;
}

function getSubmitPromptsForm(): SubmitPromptsForm {
	const submit = (PromptsEditorModule as unknown as { submitPromptsForm?: SubmitPromptsForm }).submitPromptsForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitPromptsForm;
}

function renderWithLocale(locale: UiLanguage, children: ReactNode) {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

function catalogMessage(locale: UiLanguage, id: string) {
	try {
		return translate(locale, id as MessageId);
	} catch {
		return "<missing>";
	}
}

describe("settings and onboarding editor localization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the Chinese onboarding form while preserving the brand identity and website placeholder", () => {
		const BrandOnboarding = BrandOnboardingModule.default;
		const markup = renderWithLocale("zh-CN", <BrandOnboarding brandId="brand-raw-id" brandName="StepFun 原名" />);

		expect(markup).toContain("设置 StepFun 原名");
		expect(markup).toContain("配置品牌并开始使用");
		expect(markup).toContain("网站");
		expect(markup).toContain("输入品牌的网站");
		expect(markup).toContain("完成设置");
		expect(markup).toContain('placeholder="example.com"');
		expect(markup).toContain('value="brand-raw-id"');
		expect(markup).toContain('value="StepFun 原名"');
		expect(markup).not.toContain("Complete Setup");
	});

	it.each(["en", "zh-CN"] as const)(
		"keeps onboarding brand, route, and website values unchanged in the %s submission path",
		async () => {
			const formData = new FormData();
			formData.set("website", "https://evidence.example.cn/path?q=CN");
			const createBrand = vi.fn(async () => ({ success: true, brandId: "brand-raw-id" }));

			const result = await getSubmitBrandOnboardingForm()(
				formData,
				{ brandId: "brand-raw-id", brandName: "StepFun 原名" },
				createBrand,
			);

			expect(result).toEqual({
				ok: true,
				submitted: {
					brandId: "brand-raw-id",
					brandName: "StepFun 原名",
					website: "https://evidence.example.cn/path?q=CN",
				},
			});
			expect(createBrand).toHaveBeenCalledWith({
				data: {
					brandId: "brand-raw-id",
					brandName: "StepFun 原名",
					website: "https://evidence.example.cn/path?q=CN",
				},
			});
		},
	);

	it("uses localized onboarding validation, preserves Task 2 brand codes, and hides arbitrary failures", async () => {
		const submit = getSubmitBrandOnboardingForm();
		const invalid = new FormData();
		invalid.set("website", "not a website");
		const valid = new FormData();
		valid.set("website", "evidence.example.cn");

		const validation = await submit(invalid, { brandId: "brand-raw-id", brandName: "StepFun 原名" }, vi.fn());
		const bounded = await submit(valid, { brandId: "brand-raw-id", brandName: "StepFun 原名" }, async () => {
			throw new Error("BRAND_CREATION_NOT_ALLOWED");
		});
		const generic = await submit(valid, { brandId: "brand-raw-id", brandName: "StepFun 原名" }, async () => {
			throw new Error("database host and stack detail must stay hidden");
		});

		expect(validation).toEqual({
			ok: false,
			fieldErrors: { website: "customer.onboarding.validation.websiteInvalid" },
		});
		expect(bounded).toEqual({ ok: false, fieldErrors: {}, formError: "customer.new.error.notAllowed" });
		expect(generic).toEqual({ ok: false, fieldErrors: {}, formError: "common.error.unexpected" });
		if (validation.ok || bounded.ok || generic.ok) throw new Error("Expected localized failures");
		expect(translate("zh-CN", validation.fieldErrors.website as MessageId)).toBe("请输入有效的网站网址或域名。");
		expect(translate("zh-CN", bounded.formError as MessageId)).toBe("当前部署不允许创建品牌。");
		expect(translate("zh-CN", generic.formError as MessageId)).not.toContain("database host");
	});

	it("renders every competitor editor control and accessibility label in Chinese without translating data", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<CompetitorsEditor
				competitors={[
					{
						_key: "competitor-key",
						name: "DeepSeek 原名",
						domains: ["deepseek.example.cn"],
						aliases: ["DS-R1"],
						expanded: true,
					},
				]}
				onChange={vi.fn()}
			/>,
		);

		expect(markup).toContain("DeepSeek 原名");
		expect(markup).toContain("deepseek.example.cn");
		expect(markup).toContain("DS-R1");
		expect(markup).toContain("名称");
		expect(markup).toContain("域名");
		expect(markup).toContain("别名");
		expect(markup).toContain("添加竞争对手");
		expect(markup).toContain("已配置 1/100 个竞争对手");
		expect(markup).toContain('aria-label="编辑 DeepSeek 原名"');
		expect(markup).toContain('aria-label="移除 DeepSeek 原名"');
		expect(markup).toContain('placeholder="竞争对手名称"');
		expect(markup).not.toContain("Add Competitor");
	});

	it("renders Chinese prompt table, immutable saved-Prompt help, controls, placeholders, and accessible labels", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<PromptsListEditor
				prompts={[
					{
						id: "prompt-raw-id",
						_key: "prompt-raw-id",
						value: "Which AI IDE works in 中国?",
						enabled: true,
						tags: ["Buyer-Journey"],
						systemTags: ["unbranded"],
					},
				]}
				onChange={vi.fn()}
			/>,
		);

		expect(markup).toContain("提示词文本");
		expect(markup).toContain("系统标签");
		expect(markup).toContain("标签");
		expect(markup).toContain("Which AI IDE works in 中国?");
		expect(markup).toContain("Buyer-Journey");
		expect(markup).toContain("unbranded");
		expect(markup).toContain("已保存的提示词文本不可修改；如需更改，请添加新提示词。");
		expect(markup).toContain('aria-label="提示词文本"');
		expect(markup).toMatch(/disabled=""[^>]+aria-label="提示词文本"/);
		expect(markup).toContain('aria-label="停用提示词"');
		expect(markup).toContain('placeholder="输入提示词文本…"');
		expect(markup).toContain("添加提示词");
		expect(markup).toContain("已配置 1/100 个提示词");
		expect(markup).not.toContain("Prompt Text");
	});

	it.each(["en", "zh-CN"] as const)(
		"keeps saved and new Prompt text, tags, ids, scope, and enabled tokens unchanged in the %s save path",
		async () => {
			const updatePrompts = vi.fn(async () => []);
			const result = await getSubmitPromptsForm()(
				{
					brandId: "brand-raw-id",
					scopeId: "scope-raw-id",
					initialPrompts: [
						{ id: "prompt-existing-id", value: "Which AI IDE works in 中国?", enabled: true, tags: ["原始标签"] },
					],
					prompts: [
						{
							id: "prompt-existing-id",
							_key: "prompt-existing-id",
							value: "Which AI IDE works in 中国?",
							enabled: false,
							tags: ["Buyer-Journey"],
							systemTags: ["unbranded"],
						},
						{
							_key: "prompt-new-key",
							value: "DeepSeek R1 在中国适合谁？",
							enabled: true,
							tags: ["新增标签"],
							systemTags: [],
						},
					],
				},
				updatePrompts,
			);

			expect(result).toEqual({
				ok: true,
				submitted: {
					brandId: "brand-raw-id",
					scopeId: "scope-raw-id",
					prompts: [
						{
							id: "prompt-existing-id",
							value: "Which AI IDE works in 中国?",
							enabled: false,
							tags: ["Buyer-Journey"],
						},
						{ value: "DeepSeek R1 在中国适合谁？", enabled: true, tags: ["新增标签"] },
					],
				},
			});
			expect(updatePrompts).toHaveBeenCalledWith({ data: result.ok ? result.submitted : undefined });
		},
	);

	it("maps a bounded Prompt permission rejection and hides arbitrary Prompt mutation failures", async () => {
		const input = {
			brandId: "brand-raw-id",
			scopeId: "scope-raw-id",
			initialPrompts: [],
			prompts: [
				{
					_key: "prompt-new-key",
					value: "Which AI IDE works in 中国?",
					enabled: true,
					tags: ["Buyer-Journey"],
					systemTags: [],
				},
			],
		};
		const submit = getSubmitPromptsForm();
		const bounded = await submit(input, async () => {
			throw new Error("Forbidden: Automatic prompt execution is managed by the platform");
		});
		const generic = await submit(input, async () => {
			throw new Error("prompt row and database stack detail");
		});

		expect(bounded).toEqual({ ok: false, formError: "settings.prompts.error.automaticScope" });
		expect(generic).toEqual({ ok: false, formError: "common.error.unexpected" });
	});

	it("defines Chinese save, pending, success, read-only, validation, and bounded/generic error copy", () => {
		expect(catalogMessage("zh-CN", "settings.action.saveChanges")).toBe("保存更改");
		expect(catalogMessage("zh-CN", "settings.action.saving")).toBe("正在保存…");
		expect(catalogMessage("zh-CN", "settings.brand.success")).toBe("品牌详情已更新。");
		expect(catalogMessage("zh-CN", "settings.prompts.readOnlyHelp")).toBe(
			"已保存的提示词文本不可修改；如需更改，请添加新提示词。",
		);
		expect(catalogMessage("zh-CN", "settings.brand.validation.domainInvalid")).toBe("请输入有效域名。");
		expect(catalogMessage("zh-CN", "settings.prompts.error.automaticScope")).toBe(
			"自动提示词执行由平台管理，无法在此编辑。",
		);
		expect(translate("zh-CN", "common.error.unexpected")).toBe("出现了问题，请重试。");
	});
});
