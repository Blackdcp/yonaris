import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrowserRunnerDeviceList, confirmBrowserRunnerDeviceRevocation } from "./browser-runner-device-list";
import type { BrowserRunnerDeviceView } from "./types";

const device: BrowserRunnerDeviceView = {
	id: "22222222-2222-4222-8222-222222222222",
	displayName: "Office Windows PC",
	extensionVersion: "1.0.0",
	browserFamily: "chrome",
	browserVersion: "140.0.0",
	platform: "windows",
	supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
	readiness: {
		"doubao.consumer_web": { status: "signed_out", adapterVersion: "doubao-1", activeConcurrency: 0 },
		"deepseek.consumer_web": { status: "ready", adapterVersion: "deepseek-1", activeConcurrency: 1 },
	},
	lastSeenAt: "2026-08-16T10:00:00.000Z",
	revokedAt: null,
	allowedBrandIds: ["stepfun"],
};

describe("BrowserRunnerDeviceList", () => {
	it("shows coarse device and channel readiness without account PII", () => {
		const markup = renderToStaticMarkup(
			<BrowserRunnerDeviceList
				brands={[{ id: "stepfun", name: "StepFun" }]}
				devices={[device]}
				now={new Date("2026-08-16T10:00:30.000Z")}
				onCreatePairing={vi.fn()}
				onRevoke={vi.fn()}
			/>,
		);

		expect(markup).toContain("Office Windows PC");
		expect(markup).toContain("Chrome 140.0.0");
		expect(markup).toContain("DeepSeek");
		expect(markup).toContain("Ready · 1 active");
		expect(markup).toContain("Doubao");
		expect(markup).toContain("Signed out");
		expect(markup).not.toMatch(/email|phone|cookie|account id/i);
	});

	it("renders a one-time pairing code with its expiry", () => {
		const markup = renderToStaticMarkup(
			<BrowserRunnerDeviceList
				brands={[{ id: "stepfun", name: "StepFun" }]}
				devices={[]}
				now={new Date("2026-08-16T10:00:30.000Z")}
				initialPairing={{ code: "yrp_one_time_code", expiresAt: "2026-08-16T10:15:00.000Z" }}
				onCreatePairing={vi.fn()}
				onRevoke={vi.fn()}
			/>,
		);

		expect(markup).toContain("yrp_one_time_code");
		expect(markup).toContain("shown only once");
		expect(markup).toContain("Copy pairing code");
		expect(markup).toContain("18:15");
	});
});

describe("confirmBrowserRunnerDeviceRevocation", () => {
	it("requires an explicit confirmation before revoking a paired device", async () => {
		const revoke = vi.fn();
		await confirmBrowserRunnerDeviceRevocation(device, revoke, () => false);
		expect(revoke).not.toHaveBeenCalled();

		await confirmBrowserRunnerDeviceRevocation(device, revoke, () => true);
		expect(revoke).toHaveBeenCalledWith(device.id);
	});
});
