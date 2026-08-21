import {
	BROWSER_EXTENSION_SURFACE_DEFINITIONS,
	BROWSER_EXTENSION_SURFACES,
} from "@workspace/lib/browser-extension-surfaces";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	calculateSamplingRunNowTaskCount,
	SamplingRunNowDialog,
	samplingBatchRefetchInterval,
} from "./sampling-run-now-dialog";
import type { BrowserRunnerDeviceView } from "./types";

const programs = [
	{
		id: "11111111-1111-4111-8111-111111111111",
		name: "China · Simplified Chinese · Scored",
		promptCount: 60,
		timezone: "Asia/Shanghai",
	},
];

function readyDevice(): BrowserRunnerDeviceView {
	return {
		id: "22222222-2222-4222-8222-222222222222",
		displayName: "Marketing MacBook",
		extensionVersion: "1.0.0",
		browserFamily: "chrome",
		browserVersion: "140.0.0",
		platform: "macos",
		supportedSurfaces: [...BROWSER_EXTENSION_SURFACES],
		readiness: Object.fromEntries(
			BROWSER_EXTENSION_SURFACE_DEFINITIONS.map(({ key, adapterVersion }) => [
				key,
				{ status: "ready" as const, adapterVersion, activeConcurrency: 0 },
			]),
		),
		lastSeenAt: "2026-08-16T10:00:00.000Z",
		revokedAt: null,
		allowedBrandIds: ["stepfun"],
	};
}

describe("SamplingRunNowDialog", () => {
	it("defaults the one-click monitoring action to one pass across all seven channels", () => {
		const markup = renderToStaticMarkup(
			<SamplingRunNowDialog
				brandId="stepfun"
				programs={programs}
				devices={[readyDevice()]}
				now={new Date("2026-08-16T10:00:30.000Z")}
				onRun={vi.fn()}
			/>,
		);

		expect(markup).toContain("Run now");
		expect(markup).toContain("All 60 enabled Prompts");
		expect(markup).toContain("60 × 7 × 1 = 420 tasks");
		expect(markup).toContain("One run per Prompt and channel");
		for (const { label } of BROWSER_EXTENSION_SURFACE_DEFINITIONS) expect(markup).toContain(label);
		expect(markup).not.toContain('type="number"');
		expect(markup).not.toMatch(/samples per prompt[^<]*input/i);
	});

	it("keeps all seven channels selected while devices are offline so tasks can queue", () => {
		const offline = readyDevice();
		offline.lastSeenAt = "2026-08-16T09:00:00.000Z";
		const markup = renderToStaticMarkup(
			<SamplingRunNowDialog
				brandId="stepfun"
				programs={programs}
				devices={[offline]}
				now={new Date("2026-08-16T10:00:30.000Z")}
				onRun={vi.fn()}
			/>,
		);

		expect(markup).toContain("Offline · will wait in queue");
		expect(markup).toContain("60 × 7 × 1 = 420 tasks");
		expect(markup).toContain("Run 420 tasks now");
	});

	it("keeps an unavailable channel selected so its task waits rather than disappearing", () => {
		const device = readyDevice();
		device.readiness["deepseek.consumer_web"] = {
			status: "unavailable",
			adapterVersion: "deepseek-1",
			activeConcurrency: 0,
		};
		const markup = renderToStaticMarkup(
			<SamplingRunNowDialog
				brandId="stepfun"
				programs={programs}
				devices={[device]}
				now={new Date("2026-08-16T10:00:30.000Z")}
				onRun={vi.fn()}
			/>,
		);

		expect(markup).toContain("Unavailable · will wait in queue");
		expect(markup).toContain("60 × 7 × 1 = 420 tasks");
		expect(markup).toContain("Run 420 tasks now");
	});
});

describe("calculateSamplingRunNowTaskCount", () => {
	it("uses the one-pass contract for the seven domestic channels", () => {
		expect(calculateSamplingRunNowTaskCount(60, 1)).toBe(60);
		expect(calculateSamplingRunNowTaskCount(60, 6)).toBe(360);
		expect(calculateSamplingRunNowTaskCount(60, 7)).toBe(420);
	});
});

describe("sampling batch refresh policy", () => {
	it("polls active batches every five seconds and settled pages every minute", () => {
		expect(samplingBatchRefetchInterval({ batches: [{ status: "in_progress" }] })).toBe(5_000);
		expect(samplingBatchRefetchInterval({ batches: [{ status: "completed" }, { status: "cancelled" }] })).toBe(60_000);
		expect(samplingBatchRefetchInterval(undefined)).toBe(60_000);
	});
});
