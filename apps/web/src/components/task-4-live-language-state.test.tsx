import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SamplingContextView } from "./sampling/types";

const harness = vi.hoisted(() => ({
	locale: "en" as "en" | "zh-CN",
	states: [] as unknown[],
	stateCursor: 0,
	effectDependencies: [] as Array<readonly unknown[] | undefined>,
	effectCursor: 0,
	buttons: [] as Array<{ onClick?: () => void | Promise<void> }>,
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
		useEffect(effect: Parameters<typeof actual.useEffect>[0], dependencies?: readonly unknown[]) {
			const index = harness.effectCursor++;
			const previous = harness.effectDependencies[index];
			const changed =
				previous === undefined ||
				dependencies === undefined ||
				previous.length !== dependencies.length ||
				dependencies.some((dependency, dependencyIndex) => !Object.is(dependency, previous[dependencyIndex]));
			if (changed) {
				harness.effectDependencies[index] = dependencies;
				effect();
			}
		},
	};
});

vi.mock("@/i18n/provider", async () => {
	const catalog = await vi.importActual<typeof import("@/i18n/catalog")>("@/i18n/catalog");
	const values = (locale: UiLanguage) => ({
		locale,
		t: (id: Parameters<typeof catalog.translate>[1], interpolation?: Parameters<typeof catalog.translate>[2]) =>
			catalog.translate(locale, id, interpolation),
		formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
			catalog.formatDate(locale, value, options),
		formatNumber: (value: number, options?: Intl.NumberFormatOptions) => catalog.formatNumber(locale, value, options),
		formatList: (items: readonly string[], options?: Intl.ListFormatOptions) =>
			catalog.formatList(locale, items, options),
	});
	const localizedValues = { en: values("en"), "zh-CN": values("zh-CN") };
	return { useI18n: () => localizedValues[harness.locale] };
});

vi.mock("@workspace/ui/components/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
	}: {
		children: ReactNode;
		onClick?: () => void | Promise<void>;
		disabled?: boolean;
	}) => {
		harness.buttons.push({ onClick });
		return (
			<button type="button" disabled={disabled}>
				{children}
			</button>
		);
	},
}));

vi.mock("@workspace/ui/components/card", () => {
	const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
	return { Card: Wrapper, CardContent: Wrapper, CardDescription: Wrapper, CardHeader: Wrapper, CardTitle: Wrapper };
});

vi.mock("@workspace/ui/components/dialog", () => {
	const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
	return {
		Dialog: Wrapper,
		DialogContent: Wrapper,
		DialogDescription: Wrapper,
		DialogFooter: Wrapper,
		DialogHeader: Wrapper,
		DialogTitle: Wrapper,
		DialogTrigger: Wrapper,
	};
});

vi.mock("@workspace/ui/components/select", () => {
	const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
	return {
		Select: Wrapper,
		SelectContent: Wrapper,
		SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
			<div data-value={value}>{children}</div>
		),
		SelectTrigger: Wrapper,
		SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
	};
});

vi.mock("@workspace/ui/components/input", () => ({ Input: (props: Record<string, unknown>) => <input {...props} /> }));
vi.mock("@workspace/ui/components/label", () => ({
	Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@workspace/ui/components/checkbox", () => ({ Checkbox: () => <input type="checkbox" /> }));

import { OpportunitiesGenerationControl } from "./opportunities-generation-control";
import { SamplingBatchCreateDialog } from "./sampling/sampling-batch-create-dialog";

type BatchCreateHandler = Parameters<typeof SamplingBatchCreateDialog>[0]["onCreate"];

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

const samplingContext: SamplingContextView = {
	brands: [{ id: "brand-raw-stepfun", name: "StepFun 原名" }],
	browserRunnerEnabled: true,
	overseasRunNow: { googleAiOverviewReady: true },
	selectedBrand: {
		id: "brand-raw-stepfun",
		name: "StepFun 原名",
		scopes: [
			{
				id: "scope-raw-cn-01",
				key: "cn-zh-scored-raw",
				name: "China scored 原始",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
				enabled: true,
				manualOnly: true,
				samplingEvaluationRole: "scored",
			},
		],
		prompts: [
			{
				id: "prompt-raw-01",
				scopeId: "scope-raw-cn-01",
				value: "阶跃星辰 StepFun 是一家什么公司？",
				tags: ["raw-tag"],
				enabled: true,
			},
		],
	},
	targets: [
		{
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_runner.doubao",
			model: "doubao-model/raw-v1",
			label: "豆包 原始目标",
			launchUrl: "https://www.doubao.com/chat/",
			surfaceKind: "chat_surface",
			defaultSessionRequirement: "anonymous_clean",
			defaultSearchRequirement: "forbidden",
		},
	],
};

function resetHarness(locale: UiLanguage = "en") {
	harness.locale = locale;
	harness.states.length = 0;
	harness.effectDependencies.length = 0;
	harness.stateCursor = 0;
	harness.effectCursor = 0;
	harness.buttons.length = 0;
}

function render(node: ReactNode): string {
	harness.stateCursor = 0;
	harness.effectCursor = 0;
	harness.buttons.length = 0;
	return renderToStaticMarkup(node);
}

function lastButtonClick(): () => void | Promise<void> {
	const onClick = harness.buttons.at(-1)?.onClick;
	if (!onClick) throw new Error("Expected the rendered operation button to have an onClick handler");
	return onClick;
}

function renderOpportunity(onGenerate: Parameters<typeof OpportunitiesGenerationControl>[0]["onGenerate"]): string {
	return render(<OpportunitiesGenerationControl brands={brands} onGenerate={onGenerate} />);
}

function renderBatch(onCreate: BatchCreateHandler): string {
	return render(<SamplingBatchCreateDialog context={samplingContext} onCreate={onCreate} />);
}

function initializeBatch(onCreate: BatchCreateHandler): void {
	renderBatch(onCreate);
	renderBatch(onCreate);
}

function setCompleteBatchDraft({ keepDefaultName = false }: { keepDefaultName?: boolean } = {}): void {
	if (!keepDefaultName) harness.states[1] = "Payload Name RAW";
	harness.states[2] = "scope-raw-cn-01";
	harness.states[3] = "browser_runner";
	harness.states[4] = new Set(["prompt-raw-01"]);
	harness.states[5] = {
		"doubao.consumer_web": {
			samplesPerPrompt: 3,
			sessionRequirement: "dedicated_sampling_profile",
			searchRequirement: "platform_default",
		},
	};
	harness.states[6] = "sampling-ui:idempotency-byte-identical";
	harness.states[7] = "2026-08-27T08:00";
	harness.states[8] = "2026-09-03T08:00";
}

async function submitBatch(onCreate: BatchCreateHandler): Promise<void> {
	renderBatch(onCreate);
	await lastButtonClick()();
}

describe("Task 4 live language state", () => {
	beforeEach(() => resetHarness());

	it("retranslates provider-tool validation, completed result, and error state while preserving raw detail", async () => {
		const validationGenerate = vi.fn();
		renderOpportunity(validationGenerate);
		await lastButtonClick()();
		harness.locale = "zh-CN";
		const validationMarkup = renderOpportunity(validationGenerate);
		expect(validationMarkup).toContain("请选择品牌和项目。");
		expect(validationMarkup).not.toContain("Select both a brand and a Program.");

		resetHarness("en");
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null, null);
		const result = {
			report: null,
			reason: "insufficient-data" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "en" as const,
		};
		const successGenerate = vi.fn(async () => result);
		renderOpportunity(successGenerate);
		await lastButtonClick()();
		harness.locale = "zh-CN";
		const successMarkup = renderOpportunity(successGenerate);
		expect(successMarkup).toContain("未生成报表：此项目需要更多追踪数据。");
		expect(successMarkup).not.toContain("No report was generated");
		expect(result.reason).toBe("insufficient-data");

		resetHarness("en");
		harness.states.push("brand-provider-raw", "scope-provider-raw", false, null, null);
		const rawError = 'PROVIDER_RAW::{"scopeId":"scope-provider-raw"}';
		const failedGenerate = vi.fn(async () => {
			throw new Error(rawError);
		});
		renderOpportunity(failedGenerate);
		await lastButtonClick()();
		harness.locale = "zh-CN";
		const errorMarkup = renderOpportunity(failedGenerate);
		expect(errorMarkup).toContain("无法生成优化机会报表。");
		expect(errorMarkup).not.toContain("Could not generate the opportunities report.");
		expect(errorMarkup).toContain(rawError.replaceAll('"', "&quot;"));
	});

	it("preserves the complete batch payload and idempotency across an English-to-Chinese switch", async () => {
		const controlCreate = vi.fn<BatchCreateHandler>(async () => undefined);
		initializeBatch(controlCreate);
		setCompleteBatchDraft();
		await submitBatch(controlCreate);
		const controlPayload = controlCreate.mock.calls[0]?.[0];
		expect(controlPayload).toBeDefined();

		resetHarness("en");
		const switchedCreate = vi.fn<BatchCreateHandler>(async () => undefined);
		initializeBatch(switchedCreate);
		setCompleteBatchDraft();
		renderBatch(switchedCreate);
		harness.locale = "zh-CN";
		renderBatch(switchedCreate);
		renderBatch(switchedCreate);
		await lastButtonClick()();

		expect(switchedCreate).toHaveBeenCalledOnce();
		expect(switchedCreate.mock.calls[0]?.[0]).toEqual(controlPayload);
		expect(switchedCreate.mock.calls[0]?.[0]?.idempotencyKey).toBe("sampling-ui:idempotency-byte-identical");
		expect(switchedCreate.mock.calls[0]?.[0]).toMatchObject({
			brandId: "brand-raw-stepfun",
			scopeId: "scope-raw-cn-01",
			executionMode: "browser_runner",
			name: "Payload Name RAW",
			promptIds: ["prompt-raw-01"],
			targets: [
				{
					surfaceTargetKey: "doubao.consumer_web",
					captureRouteKey: "browser_extension.doubao",
					evaluationRole: "scored",
					samplesPerPrompt: 3,
					sessionRequirement: "dedicated_sampling_profile",
					searchRequirement: "platform_default",
				},
			],
		});
	});

	it("uses the same submitted default batch name in both UI languages", async () => {
		const submitDefault = async (locale: UiLanguage) => {
			resetHarness(locale);
			const onCreate = vi.fn<BatchCreateHandler>(async () => undefined);
			initializeBatch(onCreate);
			setCompleteBatchDraft({ keepDefaultName: true });
			await submitBatch(onCreate);
			return onCreate.mock.calls[0]?.[0];
		};

		const englishPayload = await submitDefault("en");
		const chinesePayload = await submitDefault("zh-CN");

		expect(englishPayload).toBeDefined();
		expect(chinesePayload).toBeDefined();
		expect(chinesePayload?.name).toBe(englishPayload?.name);
		expect(chinesePayload).toEqual(englishPayload);
	});
});
