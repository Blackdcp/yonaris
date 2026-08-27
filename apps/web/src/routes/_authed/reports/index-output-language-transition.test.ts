import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY } from "@/lib/artifact-language-selection";

type ReportFormData = {
	brandName: string;
	brandWebsite: string;
	manualPrompts: string;
	outputLanguage: OutputLanguage;
};

type MutationOptions = {
	mutationFn: (data: ReportFormData) => Promise<unknown>;
	onSuccess?: (data: unknown, variables: ReportFormData) => void;
	onError?: (error: Error) => void;
};

type SelectProps = {
	id?: string;
	value?: string;
	disabled?: boolean;
	onChange?: (event: { target: { value: string } }) => void;
};

type FormProps = {
	onSubmit?: (event: { preventDefault: () => void }) => void;
};

type FieldProps = {
	id?: string;
	value?: string;
	disabled?: boolean;
	onChange?: (event: { target: { value: string } }) => void;
};

type ButtonProps = {
	type?: "button" | "submit";
	disabled?: boolean;
	children?: ReactNode;
};

type SidebarInsetProps = {
	children?: ReactNode;
	lang?: string;
};

type ReportRow = {
	id: string;
	brandName: string;
	brandWebsite: string;
	status: string;
	outputLanguage: OutputLanguage;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem"> & {
	values: Map<string, string>;
};

const harness = vi.hoisted(() => ({
	states: [] as unknown[],
	stateCursor: 0,
	effectDependencies: [] as Array<readonly unknown[] | undefined>,
	effectCursor: 0,
	pendingEffects: [] as Array<() => void>,
}));

const mocks = vi.hoisted(() => ({
	uiLanguage: "en" as UiLanguage,
	query: { data: [] as ReportRow[], error: null as unknown, isLoading: false },
	queryOptions: [] as Array<{ queryKey?: unknown; queryFn?: () => unknown }>,
	mutationOptions: undefined as MutationOptions | undefined,
	mutate: vi.fn(),
	mutationPending: false,
	createReportFn: vi.fn(),
	invalidateQueries: vi.fn(),
	trackEvent: vi.fn(),
	selects: [] as SelectProps[],
	forms: [] as FormProps[],
	inputs: [] as FieldProps[],
	textareas: [] as FieldProps[],
	buttons: [] as ButtonProps[],
	sidebarInsets: [] as SidebarInsetProps[],
	rawDetails: [] as string[],
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
		useEffect(effect: () => void, dependencies?: readonly unknown[]) {
			const index = harness.effectCursor++;
			const previous = harness.effectDependencies[index];
			const changed =
				previous === undefined ||
				dependencies === undefined ||
				previous.length !== dependencies.length ||
				dependencies.some((dependency, dependencyIndex) => !Object.is(dependency, previous[dependencyIndex]));
			if (changed) {
				harness.effectDependencies[index] = dependencies;
				harness.pendingEffects.push(effect);
			}
		},
	};
});

vi.mock("react/jsx-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
	type JsxFactory = typeof actual.jsx;
	const capture = (factory: JsxFactory): JsxFactory =>
		((type, props, key) => {
			if (type === "select") mocks.selects.push(props as SelectProps);
			if (type === "form") mocks.forms.push(props as FormProps);
			return factory(type, props, key);
		}) as JsxFactory;
	return { ...actual, jsx: capture(actual.jsx), jsxs: capture(actual.jsxs) };
});

vi.mock("react/jsx-dev-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
	const jsxDEV: typeof actual.jsxDEV = (type, props, key, isStaticChildren, source, self) => {
		if (type === "select") mocks.selects.push(props as SelectProps);
		if (type === "form") mocks.forms.push(props as FormProps);
		return actual.jsxDEV(type, props, key, isStaticChildren, source, self);
	};
	return { ...actual, jsxDEV };
});

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: MutationOptions) => {
		mocks.mutationOptions = options;
		return { mutate: mocks.mutate, isPending: mocks.mutationPending };
	},
	useQuery: (options: { queryKey?: unknown; queryFn?: () => unknown }) => {
		mocks.queryOptions.push(options);
		return mocks.query;
	},
	useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@tanstack/react-router", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		createFileRoute: () => (options: Record<string, unknown>) => ({
			...options,
			options,
			useRouteContext: () => ({ isAdmin: true, hasReportAccess: true }),
		}),
		Link: ({ children, to }: { children: ReactNode; to: string }) => React.createElement("a", { href: to }, children),
		notFound: vi.fn(),
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));

vi.mock("@workspace/ui/components/button", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		Button: ({ children, ...props }: ButtonProps) => {
			mocks.buttons.push({ children, ...props });
			return React.createElement("button", props, children);
		},
	};
});

vi.mock("@workspace/ui/components/input", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		Input: (props: FieldProps) => {
			mocks.inputs.push(props);
			return React.createElement("input", props);
		},
	};
});

vi.mock("@workspace/ui/components/textarea", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		Textarea: (props: FieldProps) => {
			mocks.textareas.push(props);
			return React.createElement("textarea", props);
		},
	};
});

vi.mock("@workspace/ui/components/label", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return { Label: ({ children, ...props }: { children: ReactNode }) => React.createElement("label", props, children) };
});

vi.mock("@workspace/ui/components/card", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		Card: ({ children }: { children: ReactNode }) => React.createElement("section", null, children),
		CardContent: ({ children }: { children: ReactNode }) => React.createElement("div", null, children),
	};
});

vi.mock("@workspace/ui/components/sidebar", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		SidebarProvider: ({ children }: { children: ReactNode }) => React.createElement("div", null, children),
		SidebarInset: ({ children, ...props }: SidebarInsetProps) => {
			mocks.sidebarInsets.push({ children, ...props });
			return React.createElement("main", props, children);
		},
	};
});

vi.mock("@workspace/ui/components/badge", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return { Badge: ({ children }: { children: ReactNode }) => React.createElement("span", null, children) };
});

vi.mock("@/components/app-sidebar", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return { AppSidebar: () => React.createElement("aside", { "data-slot": "reports-sidebar" }) };
});

vi.mock("@/components/site-header", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return { SiteHeader: () => React.createElement("header", { "data-slot": "reports-header" }) };
});

vi.mock("@/components/localized-raw-detail", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		LocalizedRawDetail: ({ detail }: { detail: string }) => {
			mocks.rawDetails.push(detail);
			return React.createElement("pre", { "data-slot": "raw-detail" }, detail);
		},
	};
});

vi.mock("@/i18n/provider", async () => {
	const { translate } = await vi.importActual<typeof import("@/i18n/catalog")>("@/i18n/catalog");
	return {
		useI18n: () => ({
			locale: mocks.uiLanguage,
			t: (id: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
				translate(mocks.uiLanguage, id, values),
		}),
	};
});

vi.mock("@/server/reports", () => ({
	createReportFn: mocks.createReportFn,
	getReportsFn: vi.fn(),
	REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE: "report-output-language-temporarily-unavailable",
}));

vi.mock("@/lib/posthog", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("@/lib/auth/helpers", () => ({
	hasReportAccess: vi.fn(),
	isAdmin: vi.fn(),
	requireAuthSession: vi.fn(),
}));
vi.mock("@/lib/config/server", () => ({ getDeployment: vi.fn() }));

import { buildReportCreateInput, Route } from "./index";

function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
	const values = new Map(Object.entries(initial));
	return {
		values,
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
	};
}

function resetMount() {
	harness.states.length = 0;
	harness.stateCursor = 0;
	harness.effectDependencies.length = 0;
	harness.effectCursor = 0;
	harness.pendingEffects.length = 0;
}

function resetRenderCaptures() {
	mocks.selects.length = 0;
	mocks.forms.length = 0;
	mocks.inputs.length = 0;
	mocks.textareas.length = 0;
	mocks.buttons.length = 0;
	mocks.sidebarInsets.length = 0;
	mocks.rawDetails.length = 0;
}

function renderRoute(uiLanguage: UiLanguage): string {
	mocks.uiLanguage = uiLanguage;
	harness.stateCursor = 0;
	harness.effectCursor = 0;
	resetRenderCaptures();
	const Component = (Route as unknown as { component: () => ReactElement }).component;
	return renderToStaticMarkup(Component());
}

function flushEffects() {
	const effects = harness.pendingEffects.splice(0);
	for (const effect of effects) effect();
}

function renderResolved(uiLanguage: UiLanguage): string {
	renderRoute(uiLanguage);
	flushEffects();
	return renderRoute(uiLanguage);
}

function field(id: string): FieldProps {
	const found = [...mocks.inputs, ...mocks.textareas].find((candidate) => candidate.id === id);
	if (!found) throw new Error(`Missing field ${id}`);
	return found;
}

function outputLanguageSelect(): SelectProps {
	const found = mocks.selects.find((candidate) => candidate.id === "reports-output-language");
	if (!found) throw new Error("Missing reports output-language selector");
	return found;
}

describe("Reports output-language route", () => {
	beforeEach(() => {
		resetMount();
		vi.unstubAllGlobals();
		mocks.query = { data: [], error: null, isLoading: false };
		mocks.queryOptions.length = 0;
		mocks.mutationOptions = undefined;
		mocks.mutate.mockReset();
		mocks.mutationPending = false;
		mocks.createReportFn.mockReset();
		mocks.invalidateQueries.mockReset();
		mocks.trackEvent.mockReset();
	});

	it.each([
		["en", "en", "Reports", "Output language"],
		["en", "zh-CN", "Reports", "Output language"],
		["zh-CN", "en", "报告", "输出语言"],
		["zh-CN", "zh-CN", "报告", "输出语言"],
	] as const)(
		"keeps %s UI chrome independent from the stored %s artifact language",
		(uiLanguage, artifactLanguage, heading, selectorLabel) => {
			const storage = memoryStorage({
				[REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: artifactLanguage,
			});
			vi.stubGlobal("window", { sessionStorage: storage });

			const markup = renderResolved(uiLanguage);

			expect(markup).toContain(`>${heading}</h1>`);
			expect(markup).toContain(`for="reports-output-language">${selectorLabel}</label>`);
			expect(markup).toContain(
				uiLanguage === "en"
					? "This only affects the content language of newly generated reports. It does not change the Portal interface language."
					: "仅影响新生成报告的内容语言，不会切换 Portal 界面语言。",
			);
			expect(markup).toMatch(/<option value="en"(?: selected="")?>English<\/option>/u);
			expect(markup).toMatch(/<option value="zh-CN"(?: selected="")?>简体中文<\/option>/u);
			expect(outputLanguageSelect()).toMatchObject({ value: artifactLanguage, disabled: false });
			expect(mocks.sidebarInsets.at(-1)).not.toHaveProperty("lang");
			expect(mocks.queryOptions.at(-1)?.queryKey).toEqual(["reports"]);
		},
	);

	it("seeds invalid storage once, persists selection changes, and restores the stored value after a full remount", () => {
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "zh-SG" });
		vi.stubGlobal("window", { sessionStorage: storage });

		renderResolved("zh-CN");
		expect(storage.setItem).toHaveBeenCalledWith(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, "zh-CN");
		expect(outputLanguageSelect().value).toBe("zh-CN");

		outputLanguageSelect().onChange?.({ target: { value: "en" } });
		expect(storage.values.get(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toBe("en");
		renderRoute("zh-CN");
		expect(outputLanguageSelect().value).toBe("en");

		resetMount();
		renderResolved("zh-CN");
		expect(outputLanguageSelect().value).toBe("en");
		expect(storage.setItem).toHaveBeenCalledTimes(2);
	});

	it("resolves safely without sessionStorage but blocks create submission until the mount effect runs", () => {
		const unresolvedMarkup = renderRoute("zh-CN");
		const unresolvedForm = mocks.forms.at(-1);

		expect(outputLanguageSelect()).toMatchObject({ value: "zh-CN", disabled: true });
		expect(mocks.buttons.find((button) => button.type === "submit")?.disabled).toBe(true);
		unresolvedForm?.onSubmit?.({ preventDefault: vi.fn() });
		expect(mocks.mutate).not.toHaveBeenCalled();
		expect(mocks.queryOptions.at(-1)?.queryKey).toEqual(["reports"]);
		expect(unresolvedMarkup).toContain("报告历史");

		flushEffects();
		renderRoute("zh-CN");
		expect(outputLanguageSelect()).toMatchObject({ value: "zh-CN", disabled: false });
	});

	it("submits the selected language through the real form and mutation, then resets fields without resetting language", async () => {
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "en" });
		vi.stubGlobal("window", { sessionStorage: storage });
		renderResolved("en");

		field("brandName").onChange?.({ target: { value: "StepFun 原名" } });
		renderRoute("en");
		field("brandWebsite").onChange?.({ target: { value: "https://stepfun.com/raw?market=CN" } });
		renderRoute("en");
		field("manualPrompts").onChange?.({ target: { value: "原始 Prompt / Raw Prompt" } });
		renderRoute("en");
		expect(renderRoute("en")).toContain("1 manual prompt will be used. Prompts will not be auto-generated.");

		outputLanguageSelect().onChange?.({ target: { value: "zh-CN" } });
		renderRoute("en");
		mocks.forms.at(-1)?.onSubmit?.({ preventDefault: vi.fn() });

		const expected = {
			brandName: "StepFun 原名",
			brandWebsite: "https://stepfun.com/raw?market=CN",
			manualPrompts: "原始 Prompt / Raw Prompt",
			outputLanguage: "zh-CN" as const,
		};
		expect(mocks.mutate).toHaveBeenCalledWith(expected);
		await mocks.mutationOptions?.mutationFn(expected);
		expect(mocks.createReportFn).toHaveBeenCalledWith({ data: expected });

		mocks.mutationOptions?.onSuccess?.({ id: "report-created" }, expected);
		const successMarkup = renderRoute("en");
		expect(successMarkup).toContain("Report request submitted successfully!");
		expect(field("brandName").value).toBe("");
		expect(field("brandWebsite").value).toBe("");
		expect(field("manualPrompts").value).toBe("");
		expect(outputLanguageSelect().value).toBe("zh-CN");
		expect(storage.values.get(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toBe("zh-CN");
		expect(mocks.trackEvent).toHaveBeenCalledWith("report_created", { has_manual_prompts: true });
	});

	it("never infers artifact language from UI, Program locale, market, or timezone fields", () => {
		expect(
			buildReportCreateInput(
				{
					brandName: "StepFun",
					brandWebsite: "https://stepfun.com",
					manualPrompts: "Prompt",
					uiLanguage: "zh-CN",
					programLocale: "zh-SG",
					market: "CN",
					timezone: "Asia/Shanghai",
				} as never,
				"en",
			),
		).toEqual({
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com",
			manualPrompts: "Prompt",
			outputLanguage: "en",
		});
	});

	it.each([
		["en", "Simplified Chinese report generation is temporarily unavailable. Please choose English and try again."],
		["zh-CN", "简体中文报告暂时无法生成，请选择英文后重试。"],
	] as const)("localizes the stable unavailable code in %s without exposing the machine token", (uiLanguage, copy) => {
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "zh-CN" });
		vi.stubGlobal("window", { sessionStorage: storage });
		renderResolved(uiLanguage);

		mocks.mutationOptions?.onError?.(new Error("report-output-language-temporarily-unavailable"));
		const markup = renderRoute(uiLanguage);

		expect(markup).toContain(copy);
		expect(markup).not.toContain("report-output-language-temporarily-unavailable");
		expect(mocks.rawDetails).not.toContain("report-output-language-temporarily-unavailable");
	});

	it("keeps LocalizedRawDetail for non-machine server errors", () => {
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "en" });
		vi.stubGlobal("window", { sessionStorage: storage });
		renderResolved("zh-CN");

		mocks.mutationOptions?.onError?.(new Error("RAW_PROVIDER_ERROR::keep untranslated"));
		const markup = renderRoute("zh-CN");

		expect(markup).toContain("无法创建报告");
		expect(mocks.rawDetails).toContain("RAW_PROVIDER_ERROR::keep untranslated");
	});

	it("renders mixed report languages from each persisted row while preserving raw brand and domain values", () => {
		mocks.query = {
			data: [
				{
					id: "report-en",
					brandName: "English Artifact 原名",
					brandWebsite: "https://raw-en.example/path",
					status: "completed",
					outputLanguage: "en",
				},
				{
					id: "report-zh",
					brandName: "中文 Artifact RAW",
					brandWebsite: "https://raw-zh.example/path",
					status: "pending",
					outputLanguage: "zh-CN",
				},
			],
			error: null,
			isLoading: false,
		};
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "zh-CN" });
		vi.stubGlobal("window", { sessionStorage: storage });

		const markup = renderResolved("zh-CN");

		expect(markup).toContain('data-report-output-language="en"');
		expect(markup).toContain('data-report-output-language="zh-CN"');
		expect(markup).toContain("报告语言：英文");
		expect(markup).toContain("报告语言：简体中文");
		expect(markup).toContain("English Artifact 原名");
		expect(markup).toContain("中文 Artifact RAW");
		expect(markup).toContain("raw-en.example");
		expect(markup).toContain("raw-zh.example");
		expect(markup).toContain("查看报告");
		expect(markup).toContain("待处理");
		expect(mocks.queryOptions.at(-1)?.queryKey).toEqual(["reports"]);
	});

	it("localizes loading, empty, and create-pending operation states", () => {
		const storage = memoryStorage({ [REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY]: "en" });
		vi.stubGlobal("window", { sessionStorage: storage });
		mocks.query = { data: [], error: null, isLoading: true };
		mocks.mutationPending = true;

		const loading = renderResolved("zh-CN");
		expect(loading).toContain("正在创建报告…");
		expect(loading).toContain("正在加载报告…");

		mocks.query = { data: [], error: null, isLoading: false };
		mocks.mutationPending = false;
		const empty = renderRoute("zh-CN");
		expect(empty).toContain("暂无报告。");
		expect(empty).toContain("留空后，系统将根据网站分析、竞争对手与关键词自动生成提示词。");
	});

	it("localizes route metadata from ambient UI language", () => {
		const head = (
			Route as unknown as {
				head: (args: {
					match: { context: { uiLanguage: UiLanguage; clientConfig: { branding: { name: string } } } };
				}) => {
					meta: Array<Record<string, string>>;
				};
			}
		).head;

		expect(
			head({ match: { context: { uiLanguage: "en", clientConfig: { branding: { name: "Portal RAW" } } } } }),
		).toEqual({
			meta: [
				{ title: "Reports · Portal RAW" },
				{ name: "description", content: "Generate and view one-time brand reports." },
			],
		});
		expect(
			head({ match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Portal RAW" } } } } }),
		).toEqual({
			meta: [{ title: "报告 · Portal RAW" }, { name: "description", content: "生成并查看一次性品牌分析报告。" }],
		});
	});
});
