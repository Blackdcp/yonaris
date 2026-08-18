import { describe, expect, it } from "vitest";
import { opportunityEmptyMessage } from "./opportunities-empty-state";

describe("opportunityEmptyMessage", () => {
	it("tells customers when an administrator has not generated this Program report", () => {
		expect(opportunityEmptyMessage("not_generated")).toContain("administrator has not generated");
	});

	it("keeps insufficient data distinct from an ungenerated report", () => {
		expect(opportunityEmptyMessage("insufficient-data")).toContain("more tracking data");
	});
});
