import type { UiLanguage } from "@workspace/config/language";
import { act, type ReactElement, type ReactNode, StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArtifactLanguageSelection } from "@/hooks/use-artifact-language-selection";
import { I18nProvider } from "@/i18n/provider";
import { artifactLanguageSelectionKey } from "@/lib/artifact-language-selection";

const opportunityRuntime = vi.hoisted(() => ({
	reads: [] as Array<[string | undefined, string | undefined, string, boolean]>,
}));
const exportRuntime = vi.hoisted(() => ({
	captures: [] as Array<{ chartLanguage: string | null; entities: string | null; lang: string; text: string }>,
	downloads: [] as Array<{ download: string; href: string }>,
	html2canvas: vi.fn(async (element: HTMLElement) => {
		const chart = element.querySelector<HTMLElement>("[data-slot='base-chart']");
		exportRuntime.captures.push({
			lang: element.lang,
			text: element.textContent ?? "",
			chartLanguage: chart?.parentElement?.getAttribute("lang") ?? null,
			entities: chart?.getAttribute("data-entities") ?? null,
		});
		return { toDataURL: () => "data:image/png;base64,stub" };
	}),
}));

vi.mock("html2canvas-pro", () => ({ default: exportRuntime.html2canvas }));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => ({ brand: "brand/raw-id" }),
	}),
	Link: ({ children }: { children: ReactNode }) => <a href="/raw">{children}</a>,
	useRouteContext: () => ({
		clientConfig: {
			mode: "local",
			features: { showOptimizeButton: false },
			branding: {},
		},
	}),
	useSearch: ({ select }: { select: (search: Record<string, unknown>) => unknown }) => select({}),
}));
vi.mock("@/hooks/use-list-filters", () => ({
	coerceLookback: (value: string | undefined, fallback: string) => value ?? fallback,
	useListFilters: () => ({
		scopeId: "scope/CN-id",
		model: "all",
		lookback: "1m",
		tags: [],
		search: "",
		isScopeResolving: false,
	}),
}));
vi.mock("@/server/prompts", () => ({ getPromptWebQueryFn: vi.fn() }));
vi.mock("./history-button", () => ({ HistoryButton: () => null }));
vi.mock("@tanstack/react-virtual", () => ({
	useWindowVirtualizer: () => ({
		getVirtualItems: () => [{ index: 0, start: 0 }],
		getTotalSize: () => 404,
		measureElement: () => undefined,
		measure: () => undefined,
	}),
}));
vi.mock("@workspace/ui/components/chart", () => ({
	ChartContainer: ({ children, config }: { children: ReactNode; config: Record<string, { label?: string }> }) => (
		<div
			data-slot="base-chart"
			data-entities={Object.values(config)
				.map((entry) => entry.label)
				.filter((label): label is string => typeof label === "string")
				.join("|")}
		>
			{children}
		</div>
	),
	ChartLegend: () => null,
	ChartLegendContent: () => null,
	ChartTooltip: () => null,
	ChartTooltipContent: () => null,
}));
vi.mock("recharts", () => ({
	Bar: () => null,
	BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CartesianGrid: () => null,
	Line: () => null,
	LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	XAxis: () => null,
	YAxis: () => null,
}));
vi.mock("@/components/filtered-list-shell", () => ({
	FilteredListShell: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock("@/components/filter-bar", () => ({
	ALL_MODELS_VALUE: "all",
	getAvailableModels: (models: string[]) => models,
}));
vi.mock("@/components/page-header", () => ({
	PageHeader: ({ children, title }: { children: ReactNode; title: string }) => (
		<main>
			<h1>{title}</h1>
			{children}
		</main>
	),
}));
vi.mock("@/components/prompt-order-dropdown", () => ({ PromptOrderDropdown: () => null }));
vi.mock("@/components/visibility-bar-section", () => ({ VisibilityBarSection: () => null }));
vi.mock("@/hooks/use-brand-access", () => ({ useBrandAccess: () => ({ canManageBrand: true }) }));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: { id: "brand/raw-id", name: "Brand 原名 / RAW" } }),
}));
vi.mock("@/hooks/use-scope-models", () => ({
	useScopeModels: () => ({ models: ["model/raw"], isResolved: true }),
}));
vi.mock("@/hooks/use-prompts-summary", () => ({
	usePromptsSummary: () => ({
		isLoading: false,
		isError: false,
		promptsSummary: {
			availableTags: [],
			prompts: [{ id: "prompt-1", value: "RAW Prompt 原样 #42", firstEvaluatedAt: "2026-08-20T00:00:00.000Z" }],
		},
	}),
}));
vi.mock("@/hooks/use-batch-chart-data", () => ({
	useBatchChartData: () => ({
		isLoading: false,
		batchChartData: {
			brand: { id: "brand/raw-id", name: "Brand 原名 / RAW" },
			competitors: [{ id: "competitor/raw-id", name: "原始竞品 / Raw Rival" }],
			chartData: [
				{
					prompt_id: "prompt-1",
					date: "2026-08-20",
					total_runs: 1,
					brand_mentioned_count: 1,
					competitor_counts: { "原始竞品 / Raw Rival": 0 },
				},
			],
			dateRange: { fromDate: "2026-08-20T00:00:00.000Z", toDate: "2026-08-20T00:00:00.000Z" },
		},
	}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ setQueryData: vi.fn() }),
}));
vi.mock("@/hooks/use-opportunities", () => ({
	opportunitiesKeys: {
		all: ["opportunities-report"],
		detail: (brandId: string, scopeId: string, outputLanguage: string) => [
			"opportunities-report",
			brandId,
			scopeId,
			outputLanguage,
		],
	},
	useOpportunities: (
		brandId: string | undefined,
		scopeId: string | undefined,
		outputLanguage: string,
		enabled: boolean,
	) => {
		opportunityRuntime.reads.push([brandId, scopeId, outputLanguage, enabled]);
		return {
			data: { report: null, reason: "not_generated", outputLanguage },
			isLoading: false,
			isError: false,
		};
	},
}));

import { Route as OpportunitiesRoute } from "@/routes/_authed/app/$brand/opportunities";
import { Route as VisibilityRoute } from "@/routes/_authed/app/$brand/visibility";
import { ChartActionsFooter } from "./chart-actions-footer";
import { OpportunitiesGenerationControl } from "./opportunities-generation-control";

const brandId = "brand/raw-id";
const scopeId = "scope/CN-id";
const storageKey = artifactLanguageSelectionKey("visibility-chart-export", brandId, scopeId);
const adminOpportunityStorageKey = artifactLanguageSelectionKey(
	"opportunities-admin",
	"brand-provider-raw",
	"scope-provider-raw",
);
const customerOpportunityStorageKey = artifactLanguageSelectionKey("opportunities-customer", brandId, scopeId);
const mountedRoots: Root[] = [];
const noDownload = () => undefined;

const visibilityRoute = VisibilityRoute as unknown as { component: () => ReactElement };
const opportunitiesRoute = OpportunitiesRoute as unknown as { component: () => ReactElement };

function Harness({ uiLanguage, onDownload = noDownload }: { uiLanguage: UiLanguage; onDownload?: () => void }) {
	const selection = useArtifactLanguageSelection("visibility-chart-export", brandId, scopeId, uiLanguage);

	return (
		<I18nProvider locale={uiLanguage}>
			<ChartActionsFooter
				promptId="prompt-1"
				promptName="RAW Prompt 原样 #42"
				brandId={brandId}
				onDownload={onDownload}
				outputLanguage={selection.outputLanguage}
				outputLanguageResolved={selection.isResolved}
				onOutputLanguageChange={selection.setOutputLanguage}
			/>
		</I18nProvider>
	);
}

function selectorIn(container: ParentNode): HTMLSelectElement {
	const selector = container.querySelector<HTMLSelectElement>("#chart-export-output-language-prompt-1");
	if (!selector) throw new Error("Missing dashboard chart output-language selector");
	return selector;
}

function opportunitySelectorIn(container: ParentNode): HTMLSelectElement {
	const selector = container.querySelector<HTMLSelectElement>("#opportunities-output-language");
	if (!selector) throw new Error("Missing production Opportunity output-language selector");
	return selector;
}

function downloadIn(container: ParentNode): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>("button");
	if (!button) throw new Error("Missing dashboard chart PNG download button");
	return button;
}

function serverContainer(uiLanguage: UiLanguage): HTMLDivElement {
	const container = document.createElement("div");
	container.innerHTML = renderToString(
		<StrictMode>
			<Harness uiLanguage={uiLanguage} />
		</StrictMode>,
	);
	document.body.append(container);
	return container;
}

async function hydrate(container: HTMLDivElement, uiLanguage: UiLanguage): Promise<Root> {
	let root!: Root;
	await act(async () => {
		root = hydrateRoot(
			container,
			<StrictMode>
				<Harness uiLanguage={uiLanguage} />
			</StrictMode>,
		);
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
	mountedRoots.push(root);
	return root;
}

async function unmount(root: Root, container: HTMLElement): Promise<void> {
	await act(async () => root.unmount());
	const index = mountedRoots.indexOf(root);
	if (index >= 0) mountedRoots.splice(index, 1);
	container.remove();
}

function VisibilityStory({ uiLanguage }: { uiLanguage: UiLanguage }): ReactElement {
	const Component = visibilityRoute.component;
	return (
		<StrictMode>
			<I18nProvider locale={uiLanguage}>
				<Component />
			</I18nProvider>
		</StrictMode>
	);
}

function visibilityServerContainer(uiLanguage: UiLanguage): HTMLDivElement {
	const container = document.createElement("div");
	container.innerHTML = renderToString(<VisibilityStory uiLanguage={uiLanguage} />);
	document.body.append(container);
	return container;
}

async function hydrateVisibility(container: HTMLDivElement, uiLanguage: UiLanguage): Promise<Root> {
	let root!: Root;
	await act(async () => {
		root = hydrateRoot(container, <VisibilityStory uiLanguage={uiLanguage} />);
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
	mountedRoots.push(root);
	return root;
}

describe("dashboard PNG output-language browser runtime", () => {
	beforeEach(() => {
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = "";
		window.sessionStorage.clear();
		opportunityRuntime.reads.length = 0;
		exportRuntime.captures.length = 0;
		exportRuntime.downloads.length = 0;
		exportRuntime.html2canvas.mockClear();
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function stubFileDownload(
			this: HTMLAnchorElement,
		) {
			exportRuntime.downloads.push({ download: this.download, href: this.href });
		});
	});

	afterEach(async () => {
		for (const root of mountedRoots.splice(0)) {
			await act(async () => root.unmount());
		}
		document.body.innerHTML = "";
		window.sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it("keeps the production footer selector and download inert until the artifact selection resolves", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		mountedRoots.push(root);
		const onDownload = vi.fn();
		const onOutputLanguageChange = vi.fn();
		const renderFooter = (isResolved: boolean) => (
			<I18nProvider locale="en">
				<ChartActionsFooter
					promptId="prompt-1"
					promptName="RAW Prompt 原样 #42"
					brandId={brandId}
					onDownload={onDownload}
					outputLanguage="zh-CN"
					outputLanguageResolved={isResolved}
					onOutputLanguageChange={onOutputLanguageChange}
				/>
			</I18nProvider>
		);

		await act(async () => root.render(renderFooter(false)));
		expect(selectorIn(container).disabled).toBe(true);
		expect(downloadIn(container).disabled).toBe(true);
		downloadIn(container).click();
		expect(onDownload).not.toHaveBeenCalled();

		await act(async () => root.render(renderFooter(true)));
		expect(selectorIn(container).disabled).toBe(false);
		expect(downloadIn(container).disabled).toBe(false);
		downloadIn(container).click();
		expect(onDownload).toHaveBeenCalledTimes(1);
	});

	it("uses the real artifact-language hook in both Opportunity generation and customer read call sites", async () => {
		window.sessionStorage.setItem(adminOpportunityStorageKey, "zh-CN");
		const adminContainer = document.createElement("div");
		document.body.append(adminContainer);
		const adminRoot = createRoot(adminContainer);
		mountedRoots.push(adminRoot);
		await act(async () => {
			adminRoot.render(
				<I18nProvider locale="en">
					<OpportunitiesGenerationControl
						onGenerate={async () => ({
							report: null,
							reason: "not_generated",
							outputLanguage: "zh-CN",
							generatedFor: null,
							lastEvaluatedAt: null,
						})}
						brands={[
							{
								id: "brand-provider-raw",
								name: "Brand 原名 / RAW",
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
		});
		const brandSelect = adminContainer.querySelector<HTMLSelectElement>("#opportunities-brand");
		const scopeSelect = adminContainer.querySelector<HTMLSelectElement>("#opportunities-program");
		if (!brandSelect || !scopeSelect) throw new Error("Missing production Opportunity admin selectors");
		await act(async () => {
			brandSelect.value = "brand-provider-raw";
			brandSelect.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await act(async () => {
			scopeSelect.value = "scope-provider-raw";
			scopeSelect.dispatchEvent(new Event("change", { bubbles: true }));
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		expect(opportunitySelectorIn(adminContainer)).toMatchObject({ value: "zh-CN", disabled: false });

		window.sessionStorage.setItem(customerOpportunityStorageKey, "en");
		const customerContainer = document.createElement("div");
		document.body.append(customerContainer);
		const customerRoot = createRoot(customerContainer);
		mountedRoots.push(customerRoot);
		const CustomerPage = opportunitiesRoute.component;
		await act(async () => {
			customerRoot.render(
				<I18nProvider locale="zh-CN">
					<CustomerPage />
				</I18nProvider>,
			);
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		expect(opportunitySelectorIn(customerContainer)).toMatchObject({ value: "en", disabled: false });
		expect(opportunityRuntime.reads).toContainEqual([brandId, scopeId, "en", true]);
	});

	it.each([
		{
			firstUi: "en",
			stored: "zh-CN",
			changed: "en",
			reloadedUi: "zh-CN",
			firstLabel: "Output language",
			reloadedLabel: "输出语言",
		},
		{
			firstUi: "zh-CN",
			stored: "en",
			changed: "zh-CN",
			reloadedUi: "en",
			firstLabel: "输出语言",
			reloadedLabel: "Output language",
		},
	] as const)(
		"keeps stored $stored truth across a $firstUi to $reloadedUi full remount",
		async ({ firstUi, stored, changed, reloadedUi, firstLabel, reloadedLabel }) => {
			window.sessionStorage.setItem(storageKey, stored);
			expect(storageKey).toBe(
				"yonaris:artifact-output-language:v1:visibility-chart-export:brand%2Fraw-id:scope%2FCN-id",
			);

			const firstContainer = serverContainer(firstUi);
			expect(selectorIn(firstContainer)).toMatchObject({ value: firstUi, disabled: true });
			const firstRoot = await hydrate(firstContainer, firstUi);
			expect(selectorIn(firstContainer)).toMatchObject({ value: stored, disabled: false });
			expect(firstContainer.textContent).toContain(firstLabel);

			await act(async () => {
				const selector = selectorIn(firstContainer);
				selector.value = changed;
				selector.dispatchEvent(new Event("change", { bubbles: true }));
			});
			expect(window.sessionStorage.getItem(storageKey)).toBe(changed);
			expect(selectorIn(firstContainer).value).toBe(changed);

			await unmount(firstRoot, firstContainer);
			const reloadedContainer = serverContainer(reloadedUi);
			expect(selectorIn(reloadedContainer)).toMatchObject({ value: reloadedUi, disabled: true });
			await hydrate(reloadedContainer, reloadedUi);
			expect(selectorIn(reloadedContainer)).toMatchObject({ value: changed, disabled: false });
			expect(reloadedContainer.textContent).toContain(reloadedLabel);
		},
	);

	it.each([
		{ firstUi: "en", stored: "zh-CN", reloadedUi: "zh-CN", label: "Output language" },
		{ firstUi: "zh-CN", stored: "en", reloadedUi: "en", label: "输出语言" },
	] as const)(
		"propagates stored $stored through the real Visibility route and PromptsDisplay chain under $firstUi UI",
		async ({ firstUi, stored, reloadedUi, label }) => {
			window.sessionStorage.setItem(storageKey, stored);
			const firstContainer = visibilityServerContainer(firstUi);
			expect(selectorIn(firstContainer)).toMatchObject({ value: firstUi, disabled: true });
			const firstRoot = await hydrateVisibility(firstContainer, firstUi);

			expect(selectorIn(firstContainer)).toMatchObject({ value: stored, disabled: false });
			expect(downloadIn(firstContainer).disabled).toBe(false);
			expect(firstContainer.textContent).toContain(label);
			expect(firstContainer.textContent).toContain("RAW Prompt 原样 #42");
			expect(firstContainer.textContent).toContain(firstUi === "en" ? "Visibility" : "可见度");
			expect(firstContainer.querySelector("[data-slot='base-chart']")?.parentElement?.getAttribute("lang")).toBeNull();
			await act(async () => {
				downloadIn(firstContainer).click();
				await new Promise<void>((resolve) => setTimeout(resolve, 250));
				for (let frame = 0; frame < 2; frame += 1) {
					await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				}
			});
			expect(exportRuntime.captures).toHaveLength(1);
			expect(exportRuntime.captures[0]).toMatchObject({
				lang: stored,
				chartLanguage: stored,
			});
			expect(exportRuntime.captures[0]?.text).toContain("RAW Prompt 原样 #42");
			expect(exportRuntime.captures[0]?.entities).toContain("Brand 原名 / RAW");
			expect(exportRuntime.captures[0]?.entities).toContain("原始竞品 / Raw Rival");
			expect(exportRuntime.downloads).toHaveLength(1);

			await unmount(firstRoot, firstContainer);
			const reloadedContainer = visibilityServerContainer(reloadedUi);
			expect(selectorIn(reloadedContainer)).toMatchObject({ value: reloadedUi, disabled: true });
			await hydrateVisibility(reloadedContainer, reloadedUi);
			expect(selectorIn(reloadedContainer)).toMatchObject({ value: stored, disabled: false });
			expect(window.sessionStorage.getItem(storageKey)).toBe(stored);
		},
	);
});
