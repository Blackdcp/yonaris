import { promoteUniqueDefaultOrgAdmin } from "@workspace/lib/db/provisioning";
import { getDeployment } from "@/lib/config/server";
import { repairLocalDefaultOrgAdminSession } from "./local-admin";
import { auth } from "./server";

/** Resolve one request's session and apply the tightly-scoped local bootstrap repair. */
export async function resolveAuthSession(headers: Headers) {
	const session = await auth.api.getSession({ headers });
	return repairLocalDefaultOrgAdminSession({
		session,
		mode: getDeployment().mode,
		promoteUniqueDefaultOrgAdmin,
	});
}
