/// <reference types="vite/client" />

import geistMonoFont from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url";
// Preload the 400-weight files used everywhere above the fold so they download
// in parallel with the CSS instead of after it (the H1 LCP element was being
// held back by the sequential HTML, CSS, and font waterfall).
import geistSansFont from "@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2?url";
import geistSansMediumFont from "@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2?url";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { NotFound } from "@/components/not-found";
import { buildDiagnosticAnalyticsBootstrapScript } from "@/lib/diagnostic-analytics-privacy";
import { initPostHog } from "@/lib/posthog";
import "../styles.css";

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
				{ name: "theme-color", content: "#f2ede3" },
				{ name: "apple-mobile-web-app-title", content: "Yonaris" },
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
				{ children: buildDiagnosticAnalyticsBootstrapScript() },
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
	const language = useRouterState({
		select: (state) =>
			state.location.pathname === "/zh" || state.location.pathname.startsWith("/zh/") ? "zh-CN" : "en",
	});

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
