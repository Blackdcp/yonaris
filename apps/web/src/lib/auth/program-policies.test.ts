import { describe, expect, it } from "vitest";
import { evaluateCustomerProgramProvisionAccess } from "./program-policies";

describe("customer program provisioning policy", () => {
	it.each(["owner", "admin", "viewer,admin", "member, owner"])("allows an exact privileged token in %s", (role) => {
		expect(evaluateCustomerProgramProvisionAccess(role)).toBe("allow");
	});

	it.each([
		undefined,
		null,
		"",
		"member",
		"viewer",
		"superadmin",
		"administrator",
		"brand-owner",
		"OWNER",
		"viewer,member",
	])("denies non-owner/admin role %s", (role) => {
		expect(evaluateCustomerProgramProvisionAccess(role)).toBe("deny");
	});
});
