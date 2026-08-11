import { promoteUniqueDefaultOrgAdmin } from "@workspace/lib/db/provisioning";
import { getDeployment } from "@/lib/config/server";
import { repairLocalDefaultOrgAdminSession } from "./local-admin";
import { auth } from "./server";

/** Resolve one request's session and apply the tightly-scoped local bootstrap repair. */
export async function resolveAuthSession(headers: Headers) {
	const mode = getDeployment().mode;
	// Local recovery updates auth rows out of band, so revalidate the signed session against the database.
	const session =
		mode === "local"
			? await auth.api.getSession({ headers, query: { disableCookieCache: true } })
			: await auth.api.getSession({ headers });
	return repairLocalDefaultOrgAdminSession({
		session,
		mode,
		promoteUniqueDefaultOrgAdmin,
	});
}
