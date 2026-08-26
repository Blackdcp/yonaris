/// <reference types="vite/client" />

import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from "@tanstack/react-router";
import { DEFAULT_APP_ICON, DEFAULT_APP_NAME, DEFAULT_THEME_COLOR } from "@workspace/config/constants";
import type { MissingEnvVar } from "@workspace/config/env";
import type { UiLanguage } from "@workspace/config/language";
import type { DeploymentMode } from "@workspace/config/types";
import { useEffect } from "react";
import MissingEnvPage from "@/components/missing-env-page";
import { translate } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";
import queryDevtools from "@/integrations/tanstack-query/devtools";
import { initPostHog } from "@/lib/posthog";
import { NotFound } from "@/router-default-components";
import { getClientConfig, getEnvValidationStateFn, type PublicClientConfig } from "@/server/config";
import { getUiLanguageFn } from "@/server/ui-language";
import appCss from "../styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
	clientConfig: PublicClientConfig;
	envValidation: {
		mode: DeploymentMode;
		missing: MissingEnvVar[];
		isValid: boolean;
	};
	uiLanguage: UiLanguage;
}

// Client-only cache avoids HTTP round-trips on SPA navigation; SSR always resolves per request.
let cachedRootData: {
	clientConfig: PublicClientConfig;
	envValidation: { mode: DeploymentMode; missing: MissingEnvVar[]; isValid: boolean };
	uiLanguage: UiLanguage;
} | null = null;

export class RootLoaderError extends Error {
	readonly uiLanguage: UiLanguage;

	constructor(cause: unknown, uiLanguage: UiLanguage) {
		super("The application shell could not be loaded.", { cause });
		this.name = "RootLoaderError";
		this.uiLanguage = uiLanguage;
	}
}

export function rootHeadContent({ appName, uiLanguage }: { appName: string; uiLanguage: UiLanguage }) {
	return {
		title: translate(uiLanguage, "root.meta.title", { appName }),
		description: translate(uiLanguage, "root.meta.description"),
		ogLocale: uiLanguage === "zh-CN" ? "zh_CN" : "en_US",
	};
}

export const Route = createRootRouteWithContext<RouterContext>()({
	notFoundComponent: NotFound,
	beforeLoad: async () => {
		if (typeof window !== "undefined" && cachedRootData) return cachedRootData;
		const uiLanguagePromise = Promise.resolve()
			.then(() => getUiLanguageFn())
			.catch(() => "en" as const);

		try {
			const [clientConfig, envValidation, uiLanguage] = await Promise.all([
				Promise.resolve().then(() => getClientConfig()),
				Promise.resolve().then(() => getEnvValidationStateFn()),
				uiLanguagePromise,
			]);
			const rootData = { clientConfig, envValidation, uiLanguage };
			if (typeof window !== "undefined") cachedRootData = rootData;
			return rootData;
		} catch (error) {
			throw new RootLoaderError(error, await uiLanguagePromise);
		}
	},
	head: ({ match }) => {
		const branding = match.context?.clientConfig?.branding;
		const analytics = match.context?.clientConfig?.analytics;
		const scripts = [];
		if (analytics?.clarityProjectId) {
			scripts.push({
				src: `https://www.clarity.ms/tag/${analytics.clarityProjectId}`,
				async: true,
			});
		}
		if (analytics?.plausibleDomain) {
			scripts.push({
				src: "/api/plausible/js/script",
				defer: true,
				"data-domain": analytics.plausibleDomain,
				"data-api": "/api/plausible/event",
			});
		}

		const hasCustomIcon = Boolean(branding?.icon && branding.icon !== DEFAULT_APP_ICON);
		const appName = branding?.name || DEFAULT_APP_NAME;
		const uiLanguage = match.context?.uiLanguage ?? "en";
		const themeColor = hasCustomIcon ? "#000000" : DEFAULT_THEME_COLOR;
		const appUrl = branding?.url ? branding.url.replace(/\/$/, "") : undefined;

		const { title, description, ogLocale } = rootHeadContent({ appName, uiLanguage });
		// Don't pass `title` to /api/og — the renderer already shows the brand
		// (default logo or whitelabel icon + name), so a "Brand - AI answer evidence"
		// title would render redundantly. Pages that override og:image can supply
		// a page-specific title via the query param.
		const ogImageParams = new URLSearchParams({ description });
		const ogImagePath = `/api/og?${ogImageParams.toString()}`;
		const ogImage = appUrl ? `${appUrl}${ogImagePath}` : ogImagePath;
		// og:logo is non-standard but used by some unfurlers (LinkedIn). Falls back
		// to the absolute branding icon URL when available.
		const ogLogo = (() => {
			if (!branding?.icon) return undefined;
			if (branding.icon.startsWith("http")) return branding.icon;
			return appUrl ? `${appUrl}${branding.icon}` : undefined;
		})();

		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "theme-color", content: themeColor },
				{ name: "apple-mobile-web-app-title", content: appName },
				{ property: "og:site_name", content: appName },
				{ property: "og:locale", content: ogLocale },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				{ property: "og:image", content: ogImage },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{ property: "og:type", content: "website" },
				...(appUrl ? [{ property: "og:url", content: appUrl }] : []),
				...(ogLogo ? [{ property: "og:logo", content: ogLogo }] : []),
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{ name: "twitter:description", content: description },
				{ name: "twitter:image", content: ogImage },
			],
			links: [
				{ rel: "stylesheet", href: appCss },
				{ rel: "manifest", href: "/api/manifest" },
				// Whitelabel uses its own icon URL for both favicon and iOS touch;
				// The default brand uses the committed SVG + opaque 180×180 PNG.
				...(hasCustomIcon && branding?.icon
					? [
							{ rel: "icon", type: "image/png", href: branding.icon },
							{ rel: "apple-touch-icon", href: branding.icon },
						]
					: [
							// Icons live under /icons/ (not the root) so browsers' default
							// probes for /favicon.ico and /apple-touch-icon.png 404 on
							// whitelabel deployments instead of picking up default assets.
							{ rel: "icon", type: "image/svg+xml", href: "/icons/yonaris-icon.svg" },
							{ rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/yonaris-icon-96.png" },
							{ rel: "icon", type: "image/x-icon", href: "/icons/favicon.ico" },
							{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
						]),
			],
			scripts,
		};
	},
	component: RootComponent,
});

export function RootComponent() {
	const { envValidation, clientConfig, uiLanguage } = Route.useRouteContext();
	const clarityProjectId = clientConfig?.analytics?.clarityProjectId;
	const brandProfile = clientConfig?.mode === "whitelabel" ? "custom" : "yonaris";

	useEffect(() => {
		const key = clientConfig?.analytics?.posthogKey;
		if (key) initPostHog(key, clientConfig.analytics.posthogHost);
	}, [clientConfig?.analytics?.posthogKey, clientConfig?.analytics?.posthogHost]);

	const clarityQueueScript = `window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};`;

	if (!envValidation.isValid) {
		return (
			<html lang={uiLanguage}>
				<head>
					<HeadContent />
				</head>
				<body data-brand={brandProfile} className="font-sans antialiased">
					<I18nProvider locale={uiLanguage}>
						<MissingEnvPage mode={envValidation.mode} missing={envValidation.missing} />
					</I18nProvider>
					<Scripts />
				</body>
			</html>
		);
	}

	return (
		<html lang={uiLanguage}>
			<head>
				{clarityProjectId && <ScriptOnce>{clarityQueueScript}</ScriptOnce>}
				<HeadContent />
			</head>
			<body data-brand={brandProfile} className="font-sans antialiased">
				<I18nProvider locale={uiLanguage}>
					<Outlet />
					<TanStackDevtools plugins={[queryDevtools]} />
				</I18nProvider>
				<Scripts />
			</body>
		</html>
	);
}
