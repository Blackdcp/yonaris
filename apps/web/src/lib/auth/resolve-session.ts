import { promoteUniqueDefaultOrgAdmin } from "@workspace/lib/db/provisioning";
import { getDeployment } from "@/lib/config/server";
import { repairLocalDefaultOrgAdminSession } from "./local-admin";
import { auth } from "./server";

/** Resolve one request's session and apply the tightly-scoped local bootstrap repair. */
export async function resolveAuthSession(headers: Headers) {
	const mode = getDeployment().mode;
	// Authorization is stateful: role changes, password resets, bans, and
	// explicit session revocation must take effect on the next request in every
	// deployment mode. Better Auth's signed cookie cache is suitable for
	// cosmetic session reads, but not for the server-side RBAC gates that all
	// customer and platform functions share through this resolver.
	const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
	return repairLocalDefaultOrgAdminSession({
		session,
		mode,
		promoteUniqueDefaultOrgAdmin,
	});
}
