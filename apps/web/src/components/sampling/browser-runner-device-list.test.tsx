import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
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
			<I18nProvider locale="en">
				<BrowserRunnerDeviceList
					brands={[{ id: "stepfun", name: "StepFun" }]}
					devices={[device]}
					now={new Date("2026-08-16T10:00:30.000Z")}
					onCreatePairing={vi.fn()}
					onRevoke={vi.fn()}
				/>
			</I18nProvider>,
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
			<I18nProvider locale="en">
				<BrowserRunnerDeviceList
					brands={[{ id: "stepfun", name: "StepFun" }]}
					devices={[]}
					now={new Date("2026-08-16T10:00:30.000Z")}
					initialPairing={{ code: "yrp_one_time_code", expiresAt: "2026-08-16T10:15:00.000Z" }}
					onCreatePairing={vi.fn()}
					onRevoke={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("yrp_one_time_code");
		expect(markup).toContain("shown only once");
		expect(markup).toContain("Copy pairing code");
		expect(markup).toContain("18:15");
	});

	it("renders Chinese operations while preserving device, browser, surface, and pairing identities", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<BrowserRunnerDeviceList
					brands={[{ id: "brand-raw-stepfun", name: "StepFun 原名" }]}
					devices={[{ ...device, displayName: "Office Windows PC 原始", allowedBrandIds: ["brand-raw-stepfun"] }]}
					now={new Date("2026-08-16T10:00:30.000Z")}
					initialPairing={{ code: "yrp_byte_identical_01", expiresAt: "2026-08-16T10:15:00.000Z" }}
					onCreatePairing={vi.fn()}
					onRevoke={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("配对本地 Chrome 设备");
		expect(markup).toContain("创建配对码");
		expect(markup).toContain("配对码仅显示一次");
		expect(markup).toContain("就绪 · 1 个活动任务");
		expect(markup).toContain("已退出登录");
		expect(markup).toContain("Office Windows PC 原始");
		expect(markup).toContain("Chrome 140.0.0");
		expect(markup).toContain("extension 1.0.0");
		expect(markup).toContain("DeepSeek");
		expect(markup).toContain("Doubao");
		expect(markup).toContain("yrp_byte_identical_01");
		expect(markup).not.toContain("Pair a local Chrome");
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

	it("localizes the destructive confirmation without changing the device id", async () => {
		const revoke = vi.fn();
		const confirm = vi.fn(() => true);

		await confirmBrowserRunnerDeviceRevocation(device, revoke, confirm, "zh-CN");

		expect(confirm).toHaveBeenCalledWith("撤销 Office Windows PC？该设备将立即停止接收新任务。");
		expect(revoke).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
	});
});
