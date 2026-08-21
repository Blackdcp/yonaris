import { describe, expect, it } from "vitest";
import { buildHeartbeat } from "./heartbeat";

describe("buildHeartbeat", () => {
	it("reports only the supported Windows and macOS Chrome platforms", () => {
		expect(buildHeartbeat("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.1 Safari/537.36")).toMatchObject({
			platform: "windows",
			browserVersion: "140.0.1",
		});
		expect(buildHeartbeat("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.1")).toMatchObject({
			platform: "macos",
		});
	});

	it("reports all six adapters as unavailable until qualified", () => {
		const heartbeat = buildHeartbeat("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.1 Safari/537.36");

		expect(heartbeat.supportedSurfaces).toEqual([
			"doubao.consumer_web",
			"deepseek.consumer_web",
			"qwen.consumer_web",
			"kimi.consumer_web",
			"wenxin.consumer_web",
			"yuanbao.consumer_web",
		]);
		expect(heartbeat.readiness).toEqual({
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "unavailable",
				adapterVersion: "deepseek-web-20260821-localpc-v8",
				activeConcurrency: 0,
			},
			"qwen.consumer_web": {
				status: "unavailable",
				adapterVersion: "qwen-web-20260821-localpc-v6",
				activeConcurrency: 0,
			},
			"kimi.consumer_web": {
				status: "unavailable",
				adapterVersion: "kimi-web-20260821-localpc-v8",
				activeConcurrency: 0,
			},
			"wenxin.consumer_web": {
				status: "unavailable",
				adapterVersion: "wenxin-web-20260821-localpc-v7",
				activeConcurrency: 0,
			},
			"yuanbao.consumer_web": {
				status: "unavailable",
				adapterVersion: "yuanbao-web-20260821-localpc-v6",
				activeConcurrency: 0,
			},
		});
	});

	it("reports the exact persisted qualification instead of promoting DeepSeek implicitly", () => {
		const heartbeat = buildHeartbeat("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.1 Safari/537.36", {
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "ready",
				adapterVersion: "deepseek-web-20260821-localpc-v8",
				activeConcurrency: 0,
			},
		});

		expect(heartbeat.readiness).toEqual({
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "ready",
				adapterVersion: "deepseek-web-20260821-localpc-v8",
				activeConcurrency: 0,
			},
			"qwen.consumer_web": {
				status: "unavailable",
				adapterVersion: "qwen-web-20260821-localpc-v6",
				activeConcurrency: 0,
			},
			"kimi.consumer_web": {
				status: "unavailable",
				adapterVersion: "kimi-web-20260821-localpc-v8",
				activeConcurrency: 0,
			},
			"wenxin.consumer_web": {
				status: "unavailable",
				adapterVersion: "wenxin-web-20260821-localpc-v7",
				activeConcurrency: 0,
			},
			"yuanbao.consumer_web": {
				status: "unavailable",
				adapterVersion: "yuanbao-web-20260821-localpc-v6",
				activeConcurrency: 0,
			},
		});
	});

	it("fails closed on an unsupported host or non-Chrome browser", () => {
		expect(() => buildHeartbeat("Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0.1")).toThrow(/Windows and macOS/i);
		expect(() => buildHeartbeat("Mozilla/5.0 (Windows NT 10.0) Firefox/141.0")).toThrow(/requires Chrome/i);
	});
});
