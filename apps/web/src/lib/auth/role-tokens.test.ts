import { describe, expect, it } from "vitest";
import { assertNonImpersonatedSession, hasRoleToken, isAdmin, isPlatformIdentity } from "./helpers";

describe("platform role tokens", () => {
	it.each(["admin", "admin,user", " user, admin ", ["user", "admin"]])(
		"recognizes Better Auth admin role %j",
		(role) => {
			expect(hasRoleToken(role, "admin")).toBe(true);
			expect(isAdmin({ user: { id: "platform", role } })).toBe(true);
			expect(isPlatformIdentity({ user: { id: "platform", role } })).toBe(true);
		},
	);

	it.each(["user", "administrator", "customer-admin", null, undefined])("does not substring-match %j", (role) => {
		expect(hasRoleToken(role, "admin")).toBe(false);
		expect(isAdmin({ user: { id: "customer", role } })).toBe(false);
	});

	it("treats an impersonated customer session as a platform identity", () => {
		const session = {
			user: { id: "customer", role: "user" },
			session: { impersonatedBy: "platform-admin" },
		};
		expect(isPlatformIdentity(session)).toBe(true);
		expect(() => assertNonImpersonatedSession(session)).toThrow("Impersonated sessions are not supported");
	});
});
