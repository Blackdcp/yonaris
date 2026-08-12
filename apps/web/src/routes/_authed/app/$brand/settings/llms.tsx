/**
 * Provider and collection-route configuration belongs to the Yonaris platform
 * workspace. Keep this legacy customer URL as an explicit fail-closed route so
 * bookmarks cannot expose platform execution details.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/app/$brand/settings/llms")({
	beforeLoad: () => {
		throw notFound();
	},
	component: () => null,
});
