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
 * The returned session is patched immediately because Better Auth's signed
 * cookie cache can still contain the pre-repair role for a few minutes.
 */
export async function repairLocalDefaultOrgAdminSession<T extends RoleSession>(input: {
	session: T | null;
	mode: DeploymentMode;
	promoteUniqueDefaultOrgAdmin: (userId: string) => Promise<boolean>;
}): Promise<T | null> {
	const { session, mode, promoteUniqueDefaultOrgAdmin } = input;
	if (!session || mode !== "local" || session.user.role === "admin") return session;
	if (!(await promoteUniqueDefaultOrgAdmin(session.user.id))) return session;

	return {
		...session,
		user: {
			...session.user,
			role: "admin",
		},
	};
}
