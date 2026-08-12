import type { DeploymentMode } from "@workspace/config/types";

export type RoleSession = {
	user: {
		id: string;
		role?: string | null;
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

/**
 * Repair installations created before local signup assigned a global role.
 * The returned session is patched for the current bootstrap request.
 */
export async function repairLocalDefaultOrgAdminSession<T extends RoleSession>(input: {
	session: T | null;
	mode: DeploymentMode;
	promoteUniqueDefaultOrgAdmin: (userId: string) => Promise<boolean>;
}): Promise<T | null> {
	const { session, mode, promoteUniqueDefaultOrgAdmin } = input;
	if (!session || mode !== "local" || session.user.role?.split(",").some((role) => role.trim() === "admin")) {
		return session;
	}
	if (!(await promoteUniqueDefaultOrgAdmin(session.user.id))) return session;

	return {
		...session,
		user: {
			...session.user,
			role: "admin",
		},
	};
}
