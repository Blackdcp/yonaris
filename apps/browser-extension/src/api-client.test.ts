import { describe, expect, it } from "vitest";
import { BrowserRunnerApiClient } from "./api-client";
import type { DeviceHeartbeatInput } from "./contracts";

const readyHeartbeat: DeviceHeartbeatInput = {
	extensionVersion: "0.1.0",
	browserFamily: "chrome",
	browserVersion: "140.0.0",
	platform: "windows",
	supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
	readiness: {
		"doubao.consumer_web": { status: "ready", adapterVersion: "doubao-1", activeConcurrency: 0 },
		"deepseek.consumer_web": { status: "ready", adapterVersion: "deepseek-1", activeConcurrency: 0 },
	},
};

describe("BrowserRunnerApiClient", () => {
	it("sends the device bearer only to the exact configured Portal origin", async () => {
		const calls: Request[] = [];
		const client = new BrowserRunnerApiClient({
			baseUrl: "https://portal.yonaris.com",
			token: `yrd_${"a".repeat(43)}`,
			fetch: async (request) => {
				calls.push(request);
				return Response.json({
					deviceId: "device-1",
					serverTime: "2026-08-16T00:00:00.000Z",
					featureVersion: "browser-extension.v1",
				});
			},
		});

		await client.heartbeat(readyHeartbeat);
		expect(calls[0]?.url).toBe("https://portal.yonaris.com/api/internal/browser-runner/v1/device/heartbeat");
		expect(calls[0]?.headers.get("Authorization")).toBe(`Bearer yrd_${"a".repeat(43)}`);
		expect(calls[0]?.redirect).toBe("error");
		expect(calls[0]?.cache).toBe("no-store");
	});

	it("never adds an authorization header to the one-time pairing exchange", async () => {
		const calls: Request[] = [];
		const client = new BrowserRunnerApiClient({
			baseUrl: "https://portal.yonaris.com",
			fetch: async (request) => {
				calls.push(request);
				return Response.json(
					{ deviceId: "device-1", deviceToken: `yrd_${"b".repeat(43)}`, allowedBrandIds: ["stepfun"] },
					{ status: 201 },
				);
			},
		});

		await client.pair({ code: "yrp_one_time", heartbeat: readyHeartbeat });
		expect(calls[0]?.url).toBe("https://portal.yonaris.com/api/internal/browser-runner/v1/pair");
		expect(calls[0]?.headers.has("Authorization")).toBe(false);
	});

	it("rejects non-HTTPS, credentialed, and non-Portal base URLs before making a request", () => {
		for (const baseUrl of [
			"http://portal.yonaris.com",
			"https://user:pass@portal.yonaris.com",
			"https://portal.yonaris.com.evil.test",
			"https://portal.yonaris.com/path",
		]) {
			expect(() => new BrowserRunnerApiClient({ baseUrl, fetch: async () => Response.json({}) })).toThrow(
				/Portal base URL/i,
			);
		}
	});
});
