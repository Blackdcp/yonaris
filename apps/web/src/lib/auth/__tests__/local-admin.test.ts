import { describe, expect, it, vi } from "vitest";
import { repairLocalDefaultOrgAdminSession } from "@/lib/auth/local-admin";

const memberSession = {
	user: { id: "user-1", email: "owner@example.com", role: "user" },
	session: { id: "session-1" },
};

describe("local default-org admin bootstrap", () => {
	it("does nothing without an authenticated session", async () => {
		const promoteUniqueDefaultOrgAdmin = vi.fn(async () => true);

		const session = await repairLocalDefaultOrgAdminSession({
			session: null,
			mode: "local",
			promoteUniqueDefaultOrgAdmin,
		});

		expect(promoteUniqueDefaultOrgAdmin).not.toHaveBeenCalled();
		expect(session).toBeNull();
	});

	it("repairs the unique default-org owner/admin and exposes admin in the same request", async () => {
		const promoteUniqueDefaultOrgAdmin = vi.fn(async () => true);

		const session = await repairLocalDefaultOrgAdminSession({
			session: memberSession,
			mode: "local",
			promoteUniqueDefaultOrgAdmin,
		});

		expect(promoteUniqueDefaultOrgAdmin).toHaveBeenCalledOnce();
		expect(promoteUniqueDefaultOrgAdmin).toHaveBeenCalledWith("user-1");
		expect(session?.user.role).toBe("admin");
	});

	it("leaves the session unchanged when the member is not uniquely eligible", async () => {
		const promoteUniqueDefaultOrgAdmin = vi.fn(async () => false);

		const session = await repairLocalDefaultOrgAdminSession({
			session: memberSession,
			mode: "local",
			promoteUniqueDefaultOrgAdmin,
		});

		expect(session?.user.role).toBe("user");
	});

	it.each(["cloud", "whitelabel", "demo"] as const)("never repairs %s sessions", async (mode) => {
		const promoteUniqueDefaultOrgAdmin = vi.fn(async () => true);

		const session = await repairLocalDefaultOrgAdminSession({
			session: memberSession,
			mode,
			promoteUniqueDefaultOrgAdmin,
		});

		expect(promoteUniqueDefaultOrgAdmin).not.toHaveBeenCalled();
		expect(session?.user.role).toBe("user");
	});

	it("does not write again for an existing global admin session", async () => {
		const promoteUniqueDefaultOrgAdmin = vi.fn(async () => true);
		const session = await repairLocalDefaultOrgAdminSession({
			session: { ...memberSession, user: { ...memberSession.user, role: "admin" } },
			mode: "local",
			promoteUniqueDefaultOrgAdmin,
		});

		expect(promoteUniqueDefaultOrgAdmin).not.toHaveBeenCalled();
		expect(session?.user.role).toBe("admin");
	});
});
