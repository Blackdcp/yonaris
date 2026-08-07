import { getRouteApi } from "@tanstack/react-router";

const brandRouteApi = getRouteApi("/_authed/app/$brand");

export function useBrandAccess() {
	const { canManageBrand } = brandRouteApi.useLoaderData();
	return { canManageBrand };
}
