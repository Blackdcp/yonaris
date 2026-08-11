import type { DeploymentMode } from "@workspace/config/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getDeployment: vi.fn(),
	getSession: vi.fn(),
	promoteUniqueDefaultOrgAdmin: vi.fn(),
	repairLocalDefaultOrgAdminSession: vi.fn(),
}));

vi.mock("@workspace/lib/db/provisioning", () => ({
	promoteUniqueDefaultOrgAdmin: mocks.promoteUniqueDefaultOrgAdmin,
}));

vi.mock("@/lib/config/server", () => ({
	getDeployment: mocks.getDeployment,
}));

vi.mock("../local-admin", () => ({
	repairLocalDefaultOrgAdminSession: mocks.repairLocalDefaultOrgAdminSession,
}));

vi.mock("../server", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { resolveAuthSession } from "../resolve-session";

const headers = new Headers({ cookie: "better-auth.session_token=signed-cookie" });
const session = {
	user: { id: "user-1", role: "admin" },
	session: { id: "session-1" },
};

function useDeploymentMode(mode: DeploymentMode) {
	mocks.getDeployment.mockReturnValue({ mode });
}

describe("resolveAuthSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSession.mockResolvedValue(session);
		mocks.repairLocalDefaultOrgAdminSession.mockResolvedValue(session);
	});

	it("bypasses the signed cookie cache in local mode", async () => {
		useDeploymentMode("local");

		await expect(resolveAuthSession(headers)).resolves.toBe(session);

		expect(mocks.getSession).toHaveBeenCalledOnce();
		expect(mocks.getSession).toHaveBeenCalledWith({
			headers,
			query: { disableCookieCache: true },
		});
		expect(mocks.repairLocalDefaultOrgAdminSession).toHaveBeenCalledWith({
			session,
			mode: "local",
			promoteUniqueDefaultOrgAdmin: mocks.promoteUniqueDefaultOrgAdmin,
		});
	});

	it.each(["cloud", "whitelabel", "demo"] as const)("keeps the signed cookie cache in %s mode", async (mode) => {
		useDeploymentMode(mode);

		await expect(resolveAuthSession(headers)).resolves.toBe(session);

		expect(mocks.getSession).toHaveBeenCalledOnce();
		expect(mocks.getSession).toHaveBeenCalledWith({ headers });
		expect(mocks.repairLocalDefaultOrgAdminSession).toHaveBeenCalledWith({
			session,
			mode,
			promoteUniqueDefaultOrgAdmin: mocks.promoteUniqueDefaultOrgAdmin,
		});
	});
});
