import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import { act, type ReactElement, StrictMode, useEffect, useReducer } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { I18nProvider } from "@/i18n/provider";
import "@/styles.css";

declare module "vitest/browser" {
	interface BrowserCommands {
		emulateMedia: (media: "screen" | "print") => Promise<void>;
	}
}

const rawBrand = "原样品牌 Brand Ω";
const rawCompetitor = "原始竞品 / Raw Rival";
const rawPrompt = "RAW Prompt 原样 #42";
const rawAnswer = "RAW Answer 原样，保持字节不变";
const rawQuery = "SITE:Raw.Example 原始 Query #42";
const rawCitationTitle = "RAW Citation Title 原样";
const rawCitationUrl = "https://raw.example/evidence?q=42&lang=source";

type ReportSearch = { outputLanguage?: OutputLanguage };

type CompletedReport = ReturnType<typeof completedReport>;

const runtime = vi.hoisted(() => ({
	notify: () => {},
	report: undefined as unknown,
	search: {} as ReportSearch,
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useLoaderData: () => ({ report: runtime.report }),
		useNavigate:
			() =>
			async ({ search }: { search: (previous: ReportSearch) => Record<string, unknown> }) => {
				const validateSearch = options.validateSearch as (value: Record<string, unknown>) => ReportSearch;
				runtime.search = validateSearch(search(runtime.search));
				runtime.notify();
			},
		useSearch: () => runtime.search,
	}),
	notFound: () => new Error("not found"),
	useRouteContext: () => ({
		clientConfig: { branding: { name: "Portal RAW", url: "https://portal.raw.example" } },
	}),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const builder = {
			validator: () => builder,
			handler: () => vi.fn(),
		};
		return builder;
	},
}));

vi.mock("@/components/logo", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return { Logo: () => React.createElement("span", { "data-slot": "report-logo" }, "Portal RAW") };
});

vi.mock("@/server/reports", () => ({ getReportByIdFn: vi.fn() }));

import { Route } from "./$reportId";

type BrowserRoute = {
	component: () => ReactElement;
	head: (input: { loaderData: { report: CompletedReport }; match: { search: ReportSearch } }) => {
		meta: Array<{ title?: string; name?: string; content?: string }>;
	};
	validateSearch: (search: Record<string, unknown>) => ReportSearch;
};

const route = Route as unknown as BrowserRoute;
const mountedRoots: Root[] = [];

function completedReport(outputLanguage: OutputLanguage) {
	return {
		id: "72000000-0000-4000-8000-000000000001",
		brandName: rawBrand,
		brandWebsite: "https://brand.example",
		status: "completed",
		outputLanguage,
		createdAt: new Date("2026-08-20T12:00:00.000Z"),
		rawOutput: {
			competitors: [{ name: rawCompetitor, domain: "raw-rival.example" }],
			prompts: [{ value: rawPrompt }],
			promptRuns: [
				{
					promptValue: rawPrompt,
					runs: [
						{
							model: "raw-model",
							version: "raw-version",
							webSearchEnabled: true,
							rawOutput: { citations: [{ title: rawCitationTitle, url: rawCitationUrl }] },
							webQueries: [rawQuery],
							textContent: rawAnswer,
							brandMentioned: true,
							competitorsMentioned: [rawCompetitor],
						},
					],
				},
			],
		},
	};
}

function routeTitle(search: ReportSearch): string {
	const result = route.head({
		loaderData: { report: runtime.report as CompletedReport },
		match: { search },
	});
	const title = result.meta.find((entry) => entry.title)?.title;
	if (!title) throw new Error("Printable report route did not return a title");
	return title;
}

function ProductionReportRoute(): ReactElement {
	const Component = route.component;
	return (
		<StrictMode>
			<Component />
		</StrictMode>
	);
}

function HydratedReportStory({ uiLanguage }: { uiLanguage: UiLanguage }): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const title = routeTitle(runtime.search);
	useEffect(() => {
		runtime.notify = refresh;
		return () => {
			runtime.notify = () => {};
		};
	}, []);
	useEffect(() => {
		document.title = title;
	}, [title]);
	return (
		<I18nProvider locale={uiLanguage}>
			<ProductionReportRoute />
		</I18nProvider>
	);
}

function selectIn(container: ParentNode): HTMLSelectElement {
	const select = container.querySelector<HTMLSelectElement>("#report-render-output-language");
	if (!select) throw new Error("Missing printable report output-language selector");
	return select;
}

function mainIn(container: ParentNode): HTMLElement {
	const main = container.querySelector<HTMLElement>("main");
	if (!main) throw new Error("Missing printable report artifact root");
	return main;
}

function seedScenario({ persisted, override }: { persisted: OutputLanguage; override?: unknown }): void {
	runtime.report = completedReport(persisted);
	runtime.search = route.validateSearch(override === undefined ? {} : { outputLanguage: override });
	document.title = routeTitle(runtime.search);
}

function createServerContainer(uiLanguage: UiLanguage): HTMLDivElement {
	const container = document.createElement("div");
	container.innerHTML = renderToString(
		<I18nProvider locale={uiLanguage}>
			<ProductionReportRoute />
		</I18nProvider>,
	);
	document.body.append(container);
	return container;
}

async function nextPaint(): Promise<void> {
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function hydrate(container: HTMLDivElement, uiLanguage: UiLanguage) {
	const recoverableErrors: unknown[] = [];
	let root!: Root;
	await act(async () => {
		root = hydrateRoot(container, <HydratedReportStory uiLanguage={uiLanguage} />, {
			onRecoverableError: (error) => recoverableErrors.push(error),
		});
		await nextPaint();
	});
	mountedRoots.push(root);
	return { recoverableErrors, root };
}

async function unmount(root: Root, container: HTMLElement): Promise<void> {
	await act(async () => root.unmount());
	const index = mountedRoots.indexOf(root);
	if (index >= 0) mountedRoots.splice(index, 1);
	container.remove();
}

describe("Printable report language browser runtime", () => {
	beforeEach(async () => {
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		await commands.emulateMedia("screen");
		document.body.innerHTML = "";
		document.title = "";
		runtime.notify = () => {};
		runtime.report = completedReport("en");
		runtime.search = {};
	});

	afterEach(async () => {
		for (const root of mountedRoots.splice(0)) {
			await act(async () => root.unmount());
		}
		await commands.emulateMedia("screen");
		runtime.notify = () => {};
		document.body.innerHTML = "";
		document.title = "";
	});

	it("hydrates persisted, exact override, and invalid fallback artifacts independently from UI language", async () => {
		const cases = [
			{
				persisted: "en",
				override: undefined,
				uiLanguage: "zh-CN",
				artifact: "en",
				title: "AI Share of Voice Report",
				selectorLabel: "输出语言",
			},
			{
				persisted: "zh-CN",
				override: undefined,
				uiLanguage: "en",
				artifact: "zh-CN",
				title: "AI 声量份额报告",
				selectorLabel: "Output language",
			},
			{
				persisted: "en",
				override: "zh-CN",
				uiLanguage: "en",
				artifact: "zh-CN",
				title: "AI 声量份额报告",
				selectorLabel: "Output language",
			},
			{
				persisted: "zh-CN",
				override: "en",
				uiLanguage: "zh-CN",
				artifact: "en",
				title: "AI Share of Voice Report",
				selectorLabel: "输出语言",
			},
			{
				persisted: "zh-CN",
				override: "zh",
				uiLanguage: "en",
				artifact: "zh-CN",
				title: "AI 声量份额报告",
				selectorLabel: "Output language",
			},
		] as const;

		for (const scenario of cases) {
			seedScenario(scenario);
			const container = createServerContainer(scenario.uiLanguage);
			expect(mainIn(container).lang).toBe(scenario.artifact);
			expect(container.textContent).toContain(scenario.title);
			expect(document.title).toBe(scenario.title);

			const mounted = await hydrate(container, scenario.uiLanguage);
			expect(mounted.recoverableErrors).toEqual([]);
			expect(mainIn(container).lang).toBe(scenario.artifact);
			expect(document.title).toBe(scenario.title);
			expect(selectIn(container).labels?.[0]?.textContent).toBe(scenario.selectorLabel);
			await unmount(mounted.root, container);
		}
	});

	it("updates the hydrated artifact and route head together and hides the accessible selector only in print", async () => {
		seedScenario({ persisted: "en" });
		const container = createServerContainer("en");
		const mounted = await hydrate(container, "en");
		expect(mounted.recoverableErrors).toEqual([]);

		const select = selectIn(container);
		const control = select.closest<HTMLElement>("div");
		if (!control) throw new Error("Missing printable report selector wrapper");
		expect(select.labels?.[0]?.textContent).toBe("Output language");
		expect(getComputedStyle(control).display).not.toBe("none");

		await act(async () => {
			select.value = "zh-CN";
			select.dispatchEvent(new Event("change", { bubbles: true }));
			await nextPaint();
		});
		expect(mainIn(container).lang).toBe("zh-CN");
		expect(document.title).toBe("AI 声量份额报告");
		expect(container.textContent).toContain("AI 声量份额报告");
		expect(container.textContent).not.toContain("AI Share of Voice Report");

		await commands.emulateMedia("print");
		expect(getComputedStyle(control).display).toBe("none");
		await commands.emulateMedia("screen");
		expect(getComputedStyle(control).display).not.toBe("none");

		await unmount(mounted.root, container);
	});

	it.each(["en", "zh-CN"] as const)(
		"hydrates byte-identical visible prompt, query, and entity evidence through the %s production route",
		async (outputLanguage) => {
			seedScenario({ persisted: outputLanguage });
			const container = createServerContainer(outputLanguage === "en" ? "zh-CN" : "en");
			const mounted = await hydrate(container, outputLanguage === "en" ? "zh-CN" : "en");
			expect(mounted.recoverableErrors).toEqual([]);

			const text = container.textContent ?? "";
			for (const rawValue of [rawBrand, rawCompetitor, rawPrompt, rawQuery]) {
				expect(text).toContain(rawValue);
			}
			expect(text).not.toContain(rawQuery.toLowerCase());
			const promptChart = [...container.querySelectorAll<HTMLElement>(`[lang="${outputLanguage}"]`)].find(
				(element) => element.tagName !== "MAIN" && element.textContent?.includes(rawPrompt),
			);
			expect(promptChart, "The real PromptChartPrint root should bind the artifact language").toBeDefined();

			await unmount(mounted.root, container);
		},
	);
});
