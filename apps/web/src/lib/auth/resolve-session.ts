import { promoteSoleUserToAdmin } from "@workspace/lib/db/provisioning";
import { getDeployment } from "@/lib/config/server";
import { repairLocalAdminSession } from "./local-admin";
import { auth } from "./server";

/** Resolve one request's session and apply the tightly-scoped local bootstrap repair. */
export async function resolveAuthSession(headers: Headers) {
	const session = await auth.api.getSession({ headers });
	return repairLocalAdminSession({
		session,
		mode: getDeployment().mode,
		promoteSoleUser: promoteSoleUserToAdmin,
	});
}
