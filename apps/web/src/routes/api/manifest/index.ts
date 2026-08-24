/**
 * /api/manifest - Dynamic Web App Manifest
 *
 * Generates a manifest.json tailored to the current deployment mode:
 *   - Whitelabel: single 128×128 icon from the configured icon URL
 *   - Local/Demo: static Yonaris icons committed to public/icons/
 *
 * Branding values (name, theme color, etc.) are read from server config
 * so they stay in sync with the rest of the app.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getDeployment } from "@/lib/config/server";
import { DEFAULT_APP_ICON, DEFAULT_BACKGROUND_COLOR, DEFAULT_THEME_COLOR } from "@workspace/config/constants";

interface ManifestIcon {
	src: string;
	sizes: string;
	type: string;
	purpose?: string;
}

function buildManifest(): object {
	const deployment = getDeployment();
	const { branding } = deployment;
	const hasCustomIcon = branding.icon !== DEFAULT_APP_ICON;

	let icons: ManifestIcon[];

	if (hasCustomIcon) {
		icons = [
			{
				src: branding.icon,
				sizes: "128x128",
				type: "image/png",
			},
		];
	} else {
		// Default-brand assets — never reference these from the whitelabel branch.
		icons = [
			{
				src: "/icons/yonaris-icon.svg",
				sizes: "any",
				type: "image/svg+xml",
			},
			{
				src: "/icons/yonaris-icon-maskable.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "maskable",
			},
			// PWA installers on Android/Chrome require concrete PNG sizes.
			{
				src: "/icons/yonaris-icon-192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icons/yonaris-icon-512.png",
				sizes: "512x512",
				type: "image/png",
			},
			{
				src: "/icons/yonaris-icon-maskable-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/icons/yonaris-icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		];
	}

	const themeColor = hasCustomIcon ? "#000000" : DEFAULT_THEME_COLOR;

	return {
		short_name: branding.name,
		name: `${branding.name} - AI answer evidence`,
		icons,
		start_url: ".",
		display: "standalone",
		theme_color: themeColor,
		background_color: DEFAULT_BACKGROUND_COLOR,
	};
}

export const Route = createFileRoute("/api/manifest/")({
	server: {
		handlers: {
			GET: () => {
				const manifest = buildManifest();
				return new Response(JSON.stringify(manifest, null, 2), {
					headers: {
						"Content-Type": "application/manifest+json",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
