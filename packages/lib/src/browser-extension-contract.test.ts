import { describe, expect, it } from "vitest";
import {
	assertBrowserRunnerVisualEvidenceProtocol,
	assertExtensionEvidenceProtocol,
	browserExtensionCaptureRoute,
	isApprovedBrowserExtensionAdapterVersion,
	isBrowserExtensionAdapterVersionBindingSatisfied,
	isCurrentBrowserExtensionAdapterVersionBindingSatisfied,
	parseBrowserExtensionSurface,
} from "./browser-extension-contract";
import {
	BROWSER_EXTENSION_SURFACE_DEFINITIONS,
	BROWSER_EXTENSION_SURFACES,
	browserExtensionSurfaceDefinition,
	mapBrowserExtensionSurfaces,
} from "./browser-extension-surfaces";

describe("browser extension contract", () => {
	it("defines the exact domestic execution order once", () => {
		expect(BROWSER_EXTENSION_SURFACES).toEqual([
			"doubao.consumer_web",
			"deepseek.consumer_web",
			"qwen.consumer_web",
			"kimi.consumer_web",
			"wenxin.consumer_web",
			"yuanbao.consumer_web",
			"zhipu.consumer_web",
		]);
		expect(BROWSER_EXTENSION_SURFACE_DEFINITIONS.map(({ label }) => label)).toEqual([
			"Doubao",
			"DeepSeek",
			"Qwen",
			"Kimi",
			"Wenxin",
			"Yuanbao",
			"Zhipu",
		]);
	});

	it("builds complete keyed state for every registered surface", () => {
		const labels = mapBrowserExtensionSurfaces((surface) => browserExtensionSurfaceDefinition(surface).label);

		expect(Object.keys(labels)).toEqual(BROWSER_EXTENSION_SURFACES);
		expect(labels["qwen.consumer_web"]).toBe("Qwen");
		expect(labels["yuanbao.consumer_web"]).toBe("Yuanbao");
	});

	it.each([
		[
			"doubao.consumer_web",
			"browser_extension.doubao",
			"https://www.doubao.com/chat/",
			"doubao-web-20260821-localpc-v13",
		],
		[
			"deepseek.consumer_web",
			"browser_extension.deepseek",
			"https://chat.deepseek.com/",
			"deepseek-web-20260822-localpc-v9",
		],
		["qwen.consumer_web", "browser_extension.qwen", "https://www.qianwen.com/", "qwen-web-20260822-localpc-v11"],
		["kimi.consumer_web", "browser_extension.kimi", "https://www.kimi.com/", "kimi-web-20260823-localpc-v16"],
		["wenxin.consumer_web", "browser_extension.wenxin", "https://wenxin.baidu.com/", "wenxin-web-20260822-localpc-v12"],
		[
			"yuanbao.consumer_web",
			"browser_extension.yuanbao",
			"https://yuanbao.tencent.com/",
			"yuanbao-web-20260825-localpc-v14",
		],
		["zhipu.consumer_web", "browser_extension.zhipu", "https://chatglm.cn/", "zhipu-web-20260825-localpc-v6"],
	] as const)("defines %s", (surface, captureRoute, launchUrl, adapterVersion) => {
		expect(browserExtensionSurfaceDefinition(surface)).toEqual({
			key: surface,
			label: expect.any(String),
			captureRoute,
			launchUrl,
			adapterVersion,
		});
	});

	it.each([
		["doubao.consumer_web", "browser_extension.doubao"],
		["deepseek.consumer_web", "browser_extension.deepseek"],
		["qwen.consumer_web", "browser_extension.qwen"],
		["kimi.consumer_web", "browser_extension.kimi"],
		["wenxin.consumer_web", "browser_extension.wenxin"],
		["yuanbao.consumer_web", "browser_extension.yuanbao"],
		["zhipu.consumer_web", "browser_extension.zhipu"],
	] as const)("maps %s to its exact capture route %s", (surface, route) => {
		expect(parseBrowserExtensionSurface(surface)).toBe(surface);
		expect(browserExtensionCaptureRoute(surface)).toBe(route);
	});

	it("rejects surfaces outside the domestic registry", () => {
		expect(() => parseBrowserExtensionSurface("unknown.consumer_web")).toThrow(/not supported/i);
	});

	it("approves Doubao v8 for production and rejects the retired v7 adapter", () => {
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v7")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260821-localpc-v13")).toBe(
			true,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v5")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("deepseek.consumer_web", "deepseek-web-stale")).toBe(false);
	});

	it("approves the exact registered adapter for every domestic surface", () => {
		for (const definition of BROWSER_EXTENSION_SURFACE_DEFINITIONS) {
			expect(isApprovedBrowserExtensionAdapterVersion(definition.key, definition.adapterVersion)).toBe(true);
			expect(isApprovedBrowserExtensionAdapterVersion(definition.key, `${definition.adapterVersion}-stale`)).toBe(
				false,
			);
		}
	});

	it("requires an explicit exact v8 binding after production activation", () => {
		expect(isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", undefined)).toBe(false);
		expect(
			isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", "doubao-web-20260818-localpc-v7"),
		).toBe(false);
		expect(
			isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", "doubao-web-20260821-localpc-v13"),
		).toBe(true);
		expect(isCurrentBrowserExtensionAdapterVersionBindingSatisfied("deepseek.consumer_web", undefined)).toBe(false);
	});

	it("requires an explicit exact request as soon as the simulated approval advances to Doubao v8", () => {
		const approval = {
			surface: "doubao.consumer_web" as const,
			approvedAdapterVersion: "doubao-web-20260821-localpc-v13",
		};

		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: undefined,
			}),
		).toBe(false);
		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: "doubao-web-20260818-localpc-v7",
			}),
		).toBe(false);
		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: "doubao-web-20260821-localpc-v13",
			}),
		).toBe(true);
	});

	it("accepts one HTML page snapshot as the complete extension evidence contract", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.deepseek",
				adapterVersion: "deepseek-web-20260814-uat1",
				minimumArtifacts: 1,
				kinds: ["page_snapshot"],
			}),
		).not.toThrow();
	});

	it("requires one bounded JPEG screenshot for the structured Doubao v8 protocol", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.doubao",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				minimumArtifacts: 1,
				kinds: ["screenshot"],
				mediaTypes: ["image/jpeg"],
				byteSizes: [512_000],
			}),
		).not.toThrow();

		for (const input of [
			{ kinds: ["page_snapshot"], mediaTypes: ["text/html"], byteSizes: [512_000] },
			{ kinds: ["screenshot"], mediaTypes: ["image/png"], byteSizes: [512_000] },
			{ kinds: ["screenshot"], mediaTypes: ["image/jpeg"], byteSizes: [2 * 1024 * 1024 + 1] },
		]) {
			expect(() =>
				assertExtensionEvidenceProtocol({
					captureRouteKey: "browser_extension.doubao",
					adapterVersion: "doubao-web-20260821-localpc-v13",
					minimumArtifacts: 1,
					...input,
				}),
			).toThrow(/exactly one bounded JPEG screenshot/i);
		}
	});

	it("requires one bounded JPEG screenshot for the structured DeepSeek v2 protocol", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.deepseek",
				adapterVersion: "deepseek-web-20260822-localpc-v9",
				minimumArtifacts: 1,
				kinds: ["screenshot"],
				mediaTypes: ["image/jpeg"],
				byteSizes: [512_000],
			}),
		).not.toThrow();
	});

	it("rejects screenshots and missing HTML snapshots for extension routes", () => {
		for (const input of [
			{
				captureRouteKey: "browser_extension.doubao",
				adapterVersion: "doubao-web-20260818-localpc-v7",
				minimumArtifacts: 2,
				kinds: ["page_snapshot", "screenshot"],
			},
			{
				captureRouteKey: "browser_extension.deepseek",
				adapterVersion: "deepseek-web-20260814-uat1",
				minimumArtifacts: 1,
				kinds: ["screenshot"],
			},
		]) {
			expect(() => assertExtensionEvidenceProtocol(input)).toThrow(/exactly one page snapshot/i);
		}
	});

	it("does not reinterpret the legacy runner evidence protocol", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_runner.doubao",
				minimumArtifacts: 2,
				kinds: ["screenshot", "page_snapshot"],
			}),
		).not.toThrow();
	});

	it.each([
		{
			visualEvidence: {
				status: "complete" as const,
				primaryArtifactId: "primary",
				segmentArtifactIds: ["segment-1", "segment-2"],
				expectedSegmentCount: 2,
				capturedSegmentCount: 2,
			},
			artifactIds: ["primary", "segment-1", "segment-2"],
			byteSizes: [3_000_000, 500_000, 600_000],
		},
		{
			visualEvidence: {
				status: "partial" as const,
				primaryArtifactId: null,
				segmentArtifactIds: ["segment-1", "segment-2"],
				expectedSegmentCount: 3,
				capturedSegmentCount: 2,
			},
			artifactIds: ["segment-1", "segment-2"],
			byteSizes: [500_000, 600_000],
		},
		{
			visualEvidence: {
				status: "unavailable" as const,
				primaryArtifactId: null,
				segmentArtifactIds: [],
				expectedSegmentCount: 0,
				capturedSegmentCount: 0,
			},
			artifactIds: [],
			byteSizes: [],
		},
	])("accepts bounded $visualEvidence.status v3 evidence", ({ visualEvidence, artifactIds, byteSizes }) => {
		expect(() =>
			assertBrowserRunnerVisualEvidenceProtocol({
				visualEvidence,
				artifactIds,
				mediaTypes: artifactIds.map(() => "image/jpeg"),
				byteSizes,
			}),
		).not.toThrow();
	});

	it.each([
		{
			label: "duplicate ids",
			visualEvidence: {
				status: "complete" as const,
				primaryArtifactId: "same",
				segmentArtifactIds: ["same"],
				expectedSegmentCount: 1,
				capturedSegmentCount: 1,
			},
			artifactIds: ["same", "same"],
			byteSizes: [10, 10],
		},
		{
			label: "partial count mismatch",
			visualEvidence: {
				status: "partial" as const,
				primaryArtifactId: null,
				segmentArtifactIds: ["segment-1"],
				expectedSegmentCount: 3,
				capturedSegmentCount: 2,
			},
			artifactIds: ["segment-1"],
			byteSizes: [10],
		},
		{
			label: "unavailable with primary",
			visualEvidence: {
				status: "unavailable" as const,
				primaryArtifactId: "primary",
				segmentArtifactIds: [],
				expectedSegmentCount: 0,
				capturedSegmentCount: 0,
			},
			artifactIds: ["primary"],
			byteSizes: [10],
		},
		{
			label: "oversized segment",
			visualEvidence: {
				status: "partial" as const,
				primaryArtifactId: null,
				segmentArtifactIds: ["segment-1"],
				expectedSegmentCount: 2,
				capturedSegmentCount: 1,
			},
			artifactIds: ["segment-1"],
			byteSizes: [1024 * 1024 + 1],
		},
		{
			label: "oversized aggregate",
			visualEvidence: {
				status: "complete" as const,
				primaryArtifactId: "primary",
				segmentArtifactIds: ["segment-1", "segment-2", "segment-3"],
				expectedSegmentCount: 3,
				capturedSegmentCount: 3,
			},
			artifactIds: ["primary", "segment-1", "segment-2", "segment-3"],
			byteSizes: [4 * 1024 * 1024, 1024 * 1024, 1024 * 1024, 1],
		},
	])("rejects $label in v3 evidence", ({ visualEvidence, artifactIds, byteSizes }) => {
		expect(() =>
			assertBrowserRunnerVisualEvidenceProtocol({
				visualEvidence,
				artifactIds,
				mediaTypes: artifactIds.map(() => "image/jpeg"),
				byteSizes,
			}),
		).toThrow(/visual evidence/i);
	});
});
