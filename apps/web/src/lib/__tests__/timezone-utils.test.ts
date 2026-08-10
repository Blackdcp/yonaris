import { describe, expect, it } from "vitest";
import { getTimezoneLookbackRange } from "@/lib/timezone-utils";

describe("getTimezoneLookbackRange", () => {
	it("uses exactly 30 inclusive calendar days for the 1m label", () => {
		expect(
			getTimezoneLookbackRange("1m", "UTC", {
				now: new Date("2024-03-31T12:00:00.000Z"),
			}),
		).toEqual({ fromDateStr: "2024-03-02", toDateStr: "2024-03-31" });
	});

	it.each([
		["3m", "2024-01-02"],
		["6m", "2023-10-04"],
		["1y", "2023-04-02"],
	] as const)("uses the shared fixed-day contract for %s", (lookback, expectedStart) => {
		expect(
			getTimezoneLookbackRange(lookback, "UTC", {
				now: new Date("2024-03-31T12:00:00.000Z"),
			}),
		).toEqual({ fromDateStr: expectedStart, toDateStr: "2024-03-31" });
	});
});
