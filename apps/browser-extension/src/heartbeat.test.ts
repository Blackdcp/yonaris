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

	it("fails closed on an unsupported host or non-Chrome browser", () => {
		expect(() => buildHeartbeat("Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0.1")).toThrow(/Windows and macOS/i);
		expect(() => buildHeartbeat("Mozilla/5.0 (Windows NT 10.0) Firefox/141.0")).toThrow(/requires Chrome/i);
	});
});
