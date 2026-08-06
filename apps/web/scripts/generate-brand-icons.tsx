#!/usr/bin/env tsx
/**
 * Generates the default Yonaris favicon and PWA icon set in apps/web/public/icons.
 *
 * The standard icon is a transparent Y monogram. Maskable and Apple Touch
 * variants place the same mark on a warm-white background.
 *
 * Usage:
 *   pnpm --filter @workspace/web generate-icons
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_BRAND_COLOR } from "@workspace/config/constants";
import { renderOgPng } from "@workspace/og/rasterize";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const OUTPUT_DIR = resolve(__dirname, "../public/icons");
const BRAND_COLOR = DEFAULT_BRAND_COLOR;
const BACKGROUND_COLOR = DEFAULT_BACKGROUND_COLOR;
const STANDARD_PATH = "M1 1h13l15 26L44 1h13L35 38v25H23V38L1 1Z";
const MASKABLE_PATH = "M25 28h16l23 39 23-39h16L72 80v26H56V80L25 28Z";

function buildStandardSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Yonaris">
  <path fill="${BRAND_COLOR}" d="${STANDARD_PATH}"/>
</svg>`;
}

function buildMaskableSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Yonaris">
  <rect width="128" height="128" rx="24" fill="${BACKGROUND_COLOR}"/>
  <path fill="${BRAND_COLOR}" d="${MASKABLE_PATH}"/>
</svg>`;
}

function StandardIcon() {
	return (
		<svg viewBox="0 0 64 64" width="100%" height="100%">
			<path fill={BRAND_COLOR} d={STANDARD_PATH} />
		</svg>
	);
}

function MaskableIcon() {
	return (
		<svg viewBox="0 0 128 128" width="100%" height="100%">
			<rect width="128" height="128" rx="24" fill={BACKGROUND_COLOR} />
			<path fill={BRAND_COLOR} d={MASKABLE_PATH} />
		</svg>
	);
}

async function renderPng(element: React.ReactElement, size: number): Promise<Buffer> {
	const font = readFileSync(require.resolve("@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff"));
	return Buffer.from(
		await renderOgPng(element, {
			width: size,
			height: size,
			fonts: [
				{
					name: "Geist Sans",
					data: font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
					style: "normal",
					weight: 400,
				},
			],
		}),
	);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [name, svg] of [
	["yonaris-icon.svg", buildStandardSvg()],
	["yonaris-icon-maskable.svg", buildMaskableSvg()],
] as const) {
	writeFileSync(resolve(OUTPUT_DIR, name), svg, "utf-8");
	console.log(`  wrote ${name}`);
}

const pngIcons = [
	{ name: "yonaris-icon-96.png", element: <StandardIcon />, size: 96 },
	{ name: "yonaris-icon-192.png", element: <StandardIcon />, size: 192 },
	{ name: "yonaris-icon-512.png", element: <StandardIcon />, size: 512 },
	{ name: "yonaris-icon-maskable-192.png", element: <MaskableIcon />, size: 192 },
	{ name: "yonaris-icon-maskable-512.png", element: <MaskableIcon />, size: 512 },
	{ name: "apple-touch-icon.png", element: <MaskableIcon />, size: 180 },
];

for (const { name, element, size } of pngIcons) {
	writeFileSync(resolve(OUTPUT_DIR, name), await renderPng(element, size));
	console.log(`  wrote ${name}`);
}

const icoPngs: Buffer[] = [];
for (const size of [16, 32, 48]) {
	icoPngs.push(await renderPng(<StandardIcon />, size));
}
writeFileSync(resolve(OUTPUT_DIR, "favicon.ico"), await pngToIco(icoPngs));
console.log("  wrote favicon.ico");

console.log(`\nIcons written to ${OUTPUT_DIR}`);
