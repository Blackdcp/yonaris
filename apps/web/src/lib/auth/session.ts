/**
 * Better-auth session helpers for TanStack Start.
 *
 * Server functions that check the session on navigation and in route guards.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { resolveAuthSession } from "./resolve-session";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await resolveAuthSession(headers);
	return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await resolveAuthSession(headers);

	if (!session) {
		throw new Error("Unauthorized");
	}

	return session;
});
