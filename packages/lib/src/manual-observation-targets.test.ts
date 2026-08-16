import { describe, expect, it } from "vitest";
import {
	assertManualObservationCaptureRouteKey,
	assertManualObservationPageUrl,
	assertManualObservationSurfaceTargetKey,
	isManualObservationCaptureRouteKey,
	isManualObservationSurfaceTargetKey,
	resolveManualObservationTarget,
} from "./manual-observation-targets";

describe("manual observation targets", () => {
	it.each([
		["doubao.consumer_web", "doubao"],
		["deepseek.consumer_web", "deepseek"],
		["kimi.consumer_web", "kimi"],
		["yuanbao.consumer_web", "yuanbao"],
		["qwen.consumer_web", "qwen"],
		["wenxin.consumer_web", "wenxin"],
	] as const)("resolves the domestic consumer surface %s", (surfaceTargetKey, model) => {
		const target = resolveManualObservationTarget({
			surfaceTargetKey,
			captureRouteKey: "manual_import.generic",
		});

		expect(target).toEqual({
			model,
			surfaceTargetKey,
			captureRouteKey: "manual_import.generic",
			surfaceKind: "consumer_web",
			captureMode: "manual_import",
		});
	});

	it("keeps capture provenance independent from the measured consumer surface", () => {
		const imported = resolveManualObservationTarget({
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "manual_import.generic",
		});
		const assisted = resolveManualObservationTarget({
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "assisted_browser.generic",
		});

		expect(imported.surfaceTargetKey).toBe(assisted.surfaceTargetKey);
		expect(imported.captureMode).toBe("manual_import");
		expect(assisted.captureMode).toBe("assisted_browser");
	});

	it.each([
		["doubao.consumer_web", "browser_extension.doubao", "doubao"],
		["deepseek.consumer_web", "browser_extension.deepseek", "deepseek"],
	] as const)("registers %s only for its exact extension route", (surfaceTargetKey, captureRouteKey, model) => {
		expect(resolveManualObservationTarget({ surfaceTargetKey, captureRouteKey })).toEqual({
			model,
			surfaceTargetKey,
			captureRouteKey,
			surfaceKind: "consumer_web",
			captureMode: "browser_runner",
		});
	});

	it("rejects cross-channel extension routes instead of relabeling the observation", () => {
		expect(() =>
			resolveManualObservationTarget({
				surfaceTargetKey: "deepseek.consumer_web",
				captureRouteKey: "browser_extension.doubao",
			}),
		).toThrow(/restricted to doubao\.consumer_web/i);
		expect(() =>
			resolveManualObservationTarget({
				surfaceTargetKey: "doubao.consumer_web",
				captureRouteKey: "browser_extension.deepseek",
			}),
		).toThrow(/restricted to deepseek\.consumer_web/i);
	});

	it("supports manually observed overseas consumer and search surfaces", () => {
		expect(
			resolveManualObservationTarget({
				surfaceTargetKey: "chatgpt.consumer_web",
				captureRouteKey: "assisted_browser.generic",
			}).model,
		).toBe("chatgpt");
		expect(
			resolveManualObservationTarget({
				surfaceTargetKey: "google_search.ai_overview",
				captureRouteKey: "manual_import.generic",
			}).surfaceKind,
		).toBe("search_surface");
	});

	it("rejects API identities instead of treating them as consumer observations", () => {
		expect(() =>
			resolveManualObservationTarget({
				surfaceTargetKey: "deepseek.official_api",
				captureRouteKey: "manual_import.generic",
			}),
		).toThrow(/surface target .* is not registered/);
		expect(isManualObservationSurfaceTargetKey("openai.responses_api")).toBe(false);
	});

	it("rejects undeclared capture routes", () => {
		expect(() =>
			resolveManualObservationTarget({
				surfaceTargetKey: "kimi.consumer_web",
				captureRouteKey: "browser-extension.unknown",
			}),
		).toThrow(/capture route .* is not registered/);
	});

	it("exposes fail-closed validators", () => {
		expect(isManualObservationSurfaceTargetKey("wenxin.consumer_web")).toBe(true);
		expect(isManualObservationCaptureRouteKey("assisted_browser.generic")).toBe(true);
		expect(() => assertManualObservationSurfaceTargetKey("wenxin.official_api")).toThrow();
		expect(() => assertManualObservationCaptureRouteKey("unknown.generic")).toThrow();
	});

	it("rejects evidence pages from a different product surface", () => {
		expect(() => assertManualObservationPageUrl("doubao.consumer_web", "https://www.doubao.com/chat/1")).not.toThrow();
		expect(() => assertManualObservationPageUrl("doubao.consumer_web", "https://chat.deepseek.com/a/chat/1")).toThrow(
			/Page host .* does not match/,
		);
		expect(() =>
			assertManualObservationPageUrl("google_search.ai_overview", "https://www.google.com.sg/search?q=geo"),
		).not.toThrow();
	});
});
