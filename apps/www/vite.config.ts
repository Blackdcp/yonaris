import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { embedBinaries, externalizeResvg } from "@workspace/og/vite-plugin";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const tslibEsm = fileURLToPath(import.meta.resolve("tslib/tslib.es6.mjs"));
const coreNegotiationPlugin = fileURLToPath(new URL("./src/server/core-negotiation-plugin.ts", import.meta.url));

export default defineConfig({
	server: {
		port: 3001,
	},
	define: {
		// Injected from this package's manifest, which shares the fixed
		// workspace release version, so version badges auto-update on release.
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@/": new URL("./src/", import.meta.url).pathname,
			tslib: tslibEsm,
		},
	},
	plugins: [
		embedBinaries(),
		externalizeResvg(),
		tailwindcss(),
		tanstackStart(),
		nitro({
			traceDeps: ["@resvg/resvg-js"],
			plugins: [coreNegotiationPlugin],
			alias: {
				tslib: tslibEsm,
			},
			vercel: {
				config: {
					version: 3,
					images: {
						sizes: [640, 750, 828, 1080, 1200, 1920, 2048],
						domains: [],
						minimumCacheTTL: 31536000,
						formats: ["image/webp"],
					},
				},
			},
		}),
		viteReact(),
	],
});
