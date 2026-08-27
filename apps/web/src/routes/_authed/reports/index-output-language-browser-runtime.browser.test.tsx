import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import { act, type ReactElement, type ReactNode, StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY } from "@/lib/artifact-language-selection";

type ReportCreateInput = {
	brandName: string;
	brandWebsite: string;
	manualPrompts: string;
	outputLanguage: OutputLanguage;
};

type RouteContext = {
	isAdmin: boolean;
	hasReportAccess: boolean;
	programLocale?: string;
	market?: string;
	timezone?: string;
};

const runtime = vi.hoisted(() => ({
	routeContext: { isAdmin: true, hasReportAccess: true } as RouteContext,
	mutations: [] as ReportCreateInput[],
	queryKeys: [] as unknown[],
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: (data: ReportCreateInput) => runtime.mutations.push(data),
	}),
	useQuery: (options: { queryKey: unknown }) => {
		runtime.queryKeys.push(options.queryKey);
		return { data: [], error: null, isLoading: false };
	},
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@tanstack/react-router", async () => {
	const React = await vi.importActual<typeof import("react")>("react");
	return {
		createFileRoute: () => (options: Record<string, unknown>) => ({
			...options,
			options,
			useRouteContext: () => runtime.routeContext,
		}),
		Link: ({ children, to }: { children: ReactNode; to: string }) => React.createElement("a", { href: to }, children),
		notFound: vi.fn(),
	};
});

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));

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
		LocalizedRawDetail: ({ detail }: { detail: string }) =>
			React.createElement("pre", { "data-slot": "raw-detail" }, detail),
	};
});

vi.mock("@/server/reports", () => ({
	createReportFn: vi.fn(),
	getReportsFn: vi.fn(),
	REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE: "report-output-language-temporarily-unavailable",
}));

vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/auth/helpers", () => ({
	hasReportAccess: vi.fn(),
	isAdmin: vi.fn(),
	requireAuthSession: vi.fn(),
}));
vi.mock("@/lib/config/server", () => ({ getDeployment: vi.fn() }));

import { Route } from "./index";

const mountedRoots: Root[] = [];

function ReportsRoute({ uiLanguage }: { uiLanguage: UiLanguage }): ReactElement {
	const Component = (Route as unknown as { component: () => ReactElement }).component;
	return (
		<I18nProvider locale={uiLanguage}>
			<StrictMode>
				<Component />
			</StrictMode>
		</I18nProvider>
	);
}

function selectIn(container: ParentNode): HTMLSelectElement {
	const select = container.querySelector<HTMLSelectElement>("#reports-output-language");
	if (!select) throw new Error("Missing reports output-language selector");
	return select;
}

function formIn(container: ParentNode): HTMLFormElement {
	const form = container.querySelector<HTMLFormElement>("form");
	if (!form) throw new Error("Missing reports form");
	return form;
}

function submitButtonIn(container: ParentNode): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (!button) throw new Error("Missing reports submit button");
	return button;
}

function createServerContainer(uiLanguage: UiLanguage): HTMLDivElement {
	const container = document.createElement("div");
	container.innerHTML = renderToString(<ReportsRoute uiLanguage={uiLanguage} />);
	document.body.append(container);
	return container;
}

async function nextPaint(): Promise<void> {
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function hydrate(container: HTMLDivElement, uiLanguage: UiLanguage) {
	const recoverableErrors: unknown[] = [];
	let root!: Root;
	const mutationCount = runtime.mutations.length;
	const unresolvedSubmit = submitButtonIn(container);
	expect(unresolvedSubmit.disabled).toBe(true);
	unresolvedSubmit.click();
	expect(runtime.mutations).toHaveLength(mutationCount);

	await act(async () => {
		root = hydrateRoot(container, <ReportsRoute uiLanguage={uiLanguage} />, {
			onRecoverableError: (error) => recoverableErrors.push(error),
		});
		await nextPaint();
	});
	expect(runtime.mutations).toHaveLength(mutationCount);
	mountedRoots.push(root);
	return { root, recoverableErrors };
}

async function unmount(root: Root, container: HTMLElement): Promise<void> {
	await act(async () => root.unmount());
	const index = mountedRoots.indexOf(root);
	if (index >= 0) mountedRoots.splice(index, 1);
	container.remove();
}

describe("Reports output-language browser runtime", () => {
	beforeEach(() => {
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = "";
		window.sessionStorage.clear();
		runtime.routeContext = { isAdmin: true, hasReportAccess: true };
		runtime.mutations.length = 0;
		runtime.queryKeys.length = 0;
	});

	afterEach(async () => {
		for (const root of mountedRoots.splice(0)) {
			await act(async () => root.unmount());
		}
		vi.restoreAllMocks();
		document.body.innerHTML = "";
		window.sessionStorage.clear();
	});

	it("hydrates unresolved SSR, restores the stored language, handles a real change, and keeps it across remount", async () => {
		runtime.routeContext = {
			isAdmin: true,
			hasReportAccess: true,
			programLocale: "zh-SG",
			market: "CN",
			timezone: "Asia/Shanghai",
		};
		window.sessionStorage.setItem(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, "zh-CN");

		const firstContainer = createServerContainer("en");
		expect(selectIn(firstContainer)).toMatchObject({ value: "en", disabled: true });
		expect(firstContainer.querySelector("main")?.getAttribute("lang")).toBeNull();

		const first = await hydrate(firstContainer, "en");
		expect(first.recoverableErrors).toEqual([]);
		expect(selectIn(firstContainer)).toMatchObject({ value: "zh-CN", disabled: false });
		expect(firstContainer.querySelector("h1")?.textContent).toBe("Reports");
		expect(firstContainer.querySelector("main")?.getAttribute("lang")).toBeNull();
		expect(runtime.queryKeys.at(-1)).toEqual(["reports"]);

		await act(async () => {
			const select = selectIn(firstContainer);
			select.value = "en";
			select.dispatchEvent(new Event("change", { bubbles: true }));
		});
		expect(window.sessionStorage.getItem(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toBe("en");
		expect(selectIn(firstContainer).value).toBe("en");

		await act(async () => {
			formIn(firstContainer).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		});
		expect(runtime.mutations.at(-1)?.outputLanguage).toBe("en");

		await unmount(first.root, firstContainer);
		const secondContainer = createServerContainer("zh-CN");
		expect(selectIn(secondContainer)).toMatchObject({ value: "zh-CN", disabled: true });
		const second = await hydrate(secondContainer, "zh-CN");
		expect(second.recoverableErrors).toEqual([]);
		expect(selectIn(secondContainer)).toMatchObject({ value: "en", disabled: false });
		expect(secondContainer.querySelector("h1")?.textContent).toBe("报告");
		expect(secondContainer.querySelector("main")?.getAttribute("lang")).toBeNull();
	});

	it("seeds missing and invalid storage exactly once from UI language under StrictMode, never Program context", async () => {
		runtime.routeContext = {
			isAdmin: true,
			hasReportAccess: true,
			programLocale: "zh-CN",
			market: "CN",
			timezone: "Asia/Shanghai",
		};
		const setItem = vi.spyOn(Storage.prototype, "setItem");

		const missingContainer = createServerContainer("en");
		const missing = await hydrate(missingContainer, "en");
		expect(missing.recoverableErrors).toEqual([]);
		expect(selectIn(missingContainer).value).toBe("en");
		expect(window.sessionStorage.getItem(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toBe("en");
		expect(setItem.mock.calls.filter(([key]) => key === REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toEqual([
			[REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, "en"],
		]);
		await unmount(missing.root, missingContainer);

		window.sessionStorage.setItem(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, "zh-SG");
		setItem.mockClear();
		runtime.routeContext.programLocale = "en";
		const invalidContainer = createServerContainer("zh-CN");
		const invalid = await hydrate(invalidContainer, "zh-CN");
		expect(invalid.recoverableErrors).toEqual([]);
		expect(selectIn(invalidContainer).value).toBe("zh-CN");
		expect(window.sessionStorage.getItem(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toBe("zh-CN");
		expect(setItem.mock.calls.filter(([key]) => key === REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY)).toEqual([
			[REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, "zh-CN"],
		]);
	});

	it("fails safely when real sessionStorage operations throw SecurityError", async () => {
		const securityError = Object.assign(new Error("blocked"), { name: "SecurityError" });
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw securityError;
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw securityError;
		});

		const container = createServerContainer("zh-CN");
		const mounted = await hydrate(container, "zh-CN");
		expect(mounted.recoverableErrors).toEqual([]);
		expect(selectIn(container)).toMatchObject({ value: "zh-CN", disabled: false });
		expect(container.querySelector("main")?.getAttribute("lang")).toBeNull();

		await act(async () => {
			const select = selectIn(container);
			select.value = "en";
			select.dispatchEvent(new Event("change", { bubbles: true }));
		});
		expect(selectIn(container).value).toBe("en");
	});
});
