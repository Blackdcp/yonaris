import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkOrgWriteAccess, requireAuthSession } from "@/lib/auth/helpers";

const getBrandSettingsAccess = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string() }))
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		return checkOrgWriteAccess(session.user.id, data.brandId);
	});

export const Route = createFileRoute("/_authed/app/$brand/settings")({
	loader: async ({ params }) => {
		if (!(await getBrandSettingsAccess({ data: { brandId: params.brand } }))) {
			throw notFound();
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	return <Outlet />;
}
