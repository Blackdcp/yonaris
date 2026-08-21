/// <reference types="vite/client" />

import geistMonoFont from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url";
// Preload the 400-weight files used everywhere above the fold so they download
// in parallel with the CSS instead of after it (the H1 LCP element was being
// held back by the HTML→CSS→font waterfall).
import geistSansFont from "@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2?url";
import geistSansMediumFont from "@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2?url";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { NotFound } from "@/components/not-found";
import { getMarketingOgImage } from "@/lib/og";
import { initPostHog } from "@/lib/posthog";
import { canonicalUrl, organizationJsonLd, SITE_DESCRIPTION, SITE_NAME, SITE_URL, websiteJsonLd } from "@/lib/seo";
import "../styles.css";

const ROOT_TITLE = SITE_NAME;
const ROOT_OG_IMAGE = canonicalUrl(getMarketingOgImage({ title: ROOT_TITLE, description: SITE_DESCRIPTION }));

export const Route = createRootRoute({
	notFoundComponent: NotFound,
	head: () => {
		const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim();

		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1",
				},
				{ title: ROOT_TITLE },
				{ name: "description", content: SITE_DESCRIPTION },
				{ property: "og:site_name", content: SITE_NAME },
				{ property: "og:locale", content: "en_US" },
				{ property: "og:type", content: "website" },
				...(SITE_URL ? [{ property: "og:url", content: SITE_URL }] : []),
				{ property: "og:title", content: ROOT_TITLE },
				{ property: "og:description", content: SITE_DESCRIPTION },
				...(ROOT_OG_IMAGE
					? [
							{ property: "og:image", content: ROOT_OG_IMAGE },
							{ property: "og:image:width", content: "1200" },
							{ property: "og:image:height", content: "630" },
							{ property: "og:image:alt", content: ROOT_TITLE },
						]
					: []),
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: ROOT_TITLE },
				{ name: "twitter:description", content: SITE_DESCRIPTION },
				...(ROOT_OG_IMAGE ? [{ name: "twitter:image", content: ROOT_OG_IMAGE }] : []),
				{ name: "theme-color", content: "#0b1220" },
				{ name: "apple-mobile-web-app-title", content: SITE_NAME },
			],
			links: [
				{
					rel: "preload",
					as: "font",
					type: "font/woff2",
					href: geistSansFont,
					crossOrigin: "anonymous",
				},
				{
					rel: "preload",
					as: "font",
					type: "font/woff2",
					href: geistSansMediumFont,
					crossOrigin: "anonymous",
				},
				{
					rel: "preload",
					as: "font",
					type: "font/woff2",
					href: geistMonoFont,
					crossOrigin: "anonymous",
				},
				{ rel: "icon", type: "image/svg+xml", href: "/icons/yonaris-icon.svg" },
				{ rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/yonaris-icon-96.png" },
				{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
				{ rel: "manifest", href: "/site.webmanifest" },
			],
			scripts: [
				websiteJsonLd(),
				organizationJsonLd(),
				...(plausibleDomain
					? [
							{
								src: "/api/plausible/js/script",
								defer: true,
								"data-domain": plausibleDomain,
								"data-api": "/api/plausible/event",
							},
						]
					: []),
			],
		};
	},
	component: RootComponent,
});

function RootComponent() {
	useEffect(() => {
		initPostHog();
	}, []);

	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	const language = useRouterState({ select: (state) => (state.location.pathname === "/zh" || state.location.pathname.startsWith("/zh/") ? "zh-CN" : "en") });

	return (
		<html lang={language} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
