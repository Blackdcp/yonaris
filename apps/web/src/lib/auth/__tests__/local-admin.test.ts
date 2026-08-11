import { describe, expect, it, vi } from "vitest";
import { repairLocalAdminSession } from "@/lib/auth/local-admin";

const memberSession = {
	user: { id: "user-1", email: "owner@example.com", role: "user" },
	session: { id: "session-1" },
};

describe("local admin bootstrap", () => {
	it("repairs a local sole user and exposes admin in the same request", async () => {
		const promoteSoleUser = vi.fn(async () => true);

		const session = await repairLocalAdminSession({ session: memberSession, mode: "local", promoteSoleUser });

		expect(promoteSoleUser).toHaveBeenCalledOnce();
		expect(promoteSoleUser).toHaveBeenCalledWith("user-1");
		expect(session?.user.role).toBe("admin");
	});

	it("does not promote when the database is not a sole-user installation", async () => {
		const promoteSoleUser = vi.fn(async () => false);

		const session = await repairLocalAdminSession({ session: memberSession, mode: "local", promoteSoleUser });

		expect(session?.user.role).toBe("user");
	});

	it.each(["cloud", "whitelabel", "demo"] as const)("never repairs %s sessions", async (mode) => {
		const promoteSoleUser = vi.fn(async () => true);

		const session = await repairLocalAdminSession({ session: memberSession, mode, promoteSoleUser });

		expect(promoteSoleUser).not.toHaveBeenCalled();
		expect(session?.user.role).toBe("user");
	});

	it("does not write again for an existing admin session", async () => {
		const promoteSoleUser = vi.fn(async () => true);
		const session = await repairLocalAdminSession({
			session: { ...memberSession, user: { ...memberSession.user, role: "admin" } },
			mode: "local",
			promoteSoleUser,
		});

		expect(promoteSoleUser).not.toHaveBeenCalled();
		expect(session?.user.role).toBe("admin");
	});
});
