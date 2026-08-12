import { describe, expect, it } from "vitest";
import { formatZonedDateTimeInput, parseZonedDateTimeInput } from "./sampling-timezone";

describe("Program measurement window timezone", () => {
	it("converts a Beijing wall time without using the browser timezone", () => {
		const instant = parseZonedDateTimeInput("2026-08-12T18:55", "Asia/Shanghai");
		expect(instant.toISOString()).toBe("2026-08-12T10:55:00.000Z");
		expect(formatZonedDateTimeInput(instant, "Asia/Shanghai")).toBe("2026-08-12T18:55");
	});

	it("rejects a local time skipped by a daylight-saving transition", () => {
		expect(() => parseZonedDateTimeInput("2026-03-08T02:30", "America/New_York")).toThrow("does not exist");
	});

	it("rejects a local time repeated by a daylight-saving transition", () => {
		expect(() => parseZonedDateTimeInput("2026-11-01T01:30", "America/New_York")).toThrow("occurs twice");
	});

	it("fails closed for an invalid Program timezone", () => {
		expect(() => parseZonedDateTimeInput("2026-08-12T18:55", "Mars/Olympus_Mons")).toThrow("Invalid Program timezone");
	});
});
