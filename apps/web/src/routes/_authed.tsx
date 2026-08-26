/**
 * Auth layout route - pathless layout that protects all child routes.
 *
 * Checks for an authenticated better-auth session, redirects to /auth/login if not found.
 */
import { useEffect, useRef } from "react";
import { createFileRoute, Outlet, redirect, useRouteContext } from "@tanstack/react-router";
import { isContentLanguage, type UiLanguage } from "@workspace/config/language";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/i18n/provider";
import { identifyUser, setPersonProperties } from "@/lib/posthog";
import type { ClientConfig } from "@workspace/config/types";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();

		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: { returnTo: location.href },
			});
		}

		return { session };
	},
	component: AuthedLayout,
});

export function savedLanguageRequiresReload(savedLanguage: unknown, currentLanguage: UiLanguage): boolean {
	return isContentLanguage(savedLanguage) && savedLanguage !== currentLanguage;
}

function AuthedLayout() {
	const context = useRouteContext({ strict: false }) as {
		session?: { user: { id: string; name?: string; email?: string; uiLanguage?: unknown } } | null;
		clientConfig?: ClientConfig;
	};
	const { locale } = useI18n();
	const identifiedRef = useRef<string | null>(null);

	useEffect(() => {
		if (savedLanguageRequiresReload(context.session?.user.uiLanguage, locale)) {
			window.location.reload();
		}
	}, [context.session?.user.uiLanguage, locale]);

	useEffect(() => {
		const user = context.session?.user;
		if (!user || identifiedRef.current === user.id) return;
		identifiedRef.current = user.id;

		identifyUser(user.id, {
			email: user.email,
			name: user.name,
			deployment_mode: context.clientConfig?.mode,
		});
		setPersonProperties({
			deployment_mode: context.clientConfig?.mode,
		});
	}, [context.session?.user, context.clientConfig?.mode]);

	return <Outlet />;
}
