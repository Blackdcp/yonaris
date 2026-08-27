import type { OutputLanguage } from "@workspace/config/language";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
	stateIndex: 0,
	states: [] as unknown[],
	container: {} as HTMLDivElement,
	click: vi.fn(),
	html2canvas: vi.fn(async () => ({ toDataURL: () => "data:image/png;base64,raw" })),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useCallback: <T,>(callback: T) => callback,
		useRef: <T,>(initial: T) => ({ current: initial === null ? harness.container : initial }),
		useState: <T,>(initial: T) => {
			const index = harness.stateIndex++;
			if (!(index in harness.states)) harness.states[index] = initial;
			return [
				harness.states[index] as T,
				(value: T | ((current: T) => T)) => {
					const current = harness.states[index] as T;
					harness.states[index] = typeof value === "function" ? (value as (current: T) => T)(current) : value;
				},
			] as const;
		},
	};
});
vi.mock("react-dom", () => ({ createPortal: (children: unknown) => children }));
vi.mock("html2canvas-pro", () => ({ default: harness.html2canvas }));
vi.mock("@tanstack/react-router", () => ({
	useRouteContext: () => ({
		clientConfig: {
			mode: "local",
			branding: { name: "Raw Portal 原名", chartColors: ["#111111", "#222222"] },
		},
	}),
}));

import { useChartExport } from "./use-chart-export";

describe("useChartExport output-language boundary", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		harness.stateIndex = 0;
		harness.states.length = 0;
		harness.click.mockClear();
		harness.html2canvas.mockClear();
		vi.stubGlobal("document", {
			body: {},
			createElement: () => ({ click: harness.click, download: "", href: "" }),
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it.each(["en", "zh-CN"] as const)(
		"captures exact %s language with byte-identical raw chart data before html2canvas",
		async (outputLanguage: OutputLanguage) => {
			const rawPrompt = "RAW Prompt 原样 #42";
			const rawBrand = { id: "brand/raw-id", name: "Brand 原名 / RAW" };
			const rawCompetitor = { id: "competitor/raw-id", name: "原始竞品 / Raw Rival" };
			const rawData = [{ date: "2026-08-20", "brand/raw-id": 42, "competitor/raw-id": 9 }];
			const { handleExport } = useChartExport("raw/file", outputLanguage);

			const exportPromise = handleExport({
				promptName: rawPrompt,
				visibility: 42,
				data: rawData,
				lookback: "all",
				brand: rawBrand as never,
				competitors: [rawCompetitor as never],
			});

			expect(harness.states[1]).toMatchObject({
				outputLanguage,
				promptName: rawPrompt,
				visibility: 42,
				data: rawData,
				brand: rawBrand,
				competitors: [rawCompetitor],
			});
			await vi.runAllTimersAsync();
			await exportPromise;
			expect(harness.html2canvas).toHaveBeenCalledWith(
				harness.container,
				expect.objectContaining({ scale: 1, logging: false, useCORS: true }),
			);
			expect(harness.click).toHaveBeenCalledOnce();
		},
	);
});
