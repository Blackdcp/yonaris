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
		supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
		readiness: {
			"doubao.consumer_web": { status: "ready", adapterVersion: "doubao-1", activeConcurrency: 0 },
			"deepseek.consumer_web": { status: "ready", adapterVersion: "deepseek-1", activeConcurrency: 0 },
		},
		lastSeenAt: "2026-08-16T10:00:00.000Z",
		revokedAt: null,
		allowedBrandIds: ["stepfun"],
	};
}

describe("SamplingRunNowDialog", () => {
	it("fixes collection at five samples per selected channel and exposes no repeat-count control", () => {
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
		expect(markup).toContain("60 × 2 × 5 = 600 tasks");
		expect(markup).toContain("Five samples per Prompt and channel");
		expect(markup).not.toContain('type="number"');
		expect(markup).not.toMatch(/samples per prompt[^<]*input/i);
	});

	it("defaults to no channels while all eligible devices are offline", () => {
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
		expect(markup).toContain("60 × 0 × 5 = 0 tasks");
		expect(markup).toContain("Run 0 tasks now");
	});

	it("defaults to only the ready channel when another channel is unavailable", () => {
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
		expect(markup).toContain("60 × 1 × 5 = 300 tasks");
		expect(markup).toContain("Run 300 tasks now");
	});
});

describe("calculateSamplingRunNowTaskCount", () => {
	it("uses the same fixed five-run contract for one or two domestic channels", () => {
		expect(calculateSamplingRunNowTaskCount(60, 1)).toBe(300);
		expect(calculateSamplingRunNowTaskCount(60, 2)).toBe(600);
	});
});

describe("sampling batch refresh policy", () => {
	it("polls active batches every five seconds and settled pages every minute", () => {
		expect(samplingBatchRefetchInterval({ batches: [{ status: "in_progress" }] })).toBe(5_000);
		expect(samplingBatchRefetchInterval({ batches: [{ status: "completed" }, { status: "cancelled" }] })).toBe(60_000);
		expect(samplingBatchRefetchInterval(undefined)).toBe(60_000);
	});
});
