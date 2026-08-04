#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOgPng } from "@workspace/og/rasterize";
import pngToIco from "png-to-ico";
/**
 * Generates favicon and PWA icon assets for the Yonaris marketing site.
 *
 * Output directories:
 *   - apps/www/public/       favicon.ico, apple-touch-icon.png
 *   - apps/www/public/icons/ yonaris icon SVG and PNG variants
 *
 * The wordmark assets are maintained separately and are never overwritten.
 *
 * Usage:
 *   pnpm -F @workspace/www generate-icons
 */
// biome-ignore lint/correctness/noUnusedImports: the script uses the classic JSX runtime
import React from "react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const BRAND_COLOR = "#0A1A2A";
const BRAND_LIGHT = "#F8F6F3";
const PUBLIC_DIR = resolve(__dirname, "../public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");

const STANDARD_Y_PATH = "M1 1h13l15 26L44 1h13L35 38v25H23V38L1 1Z";
const MASKABLE_Y_PATH = "M25 28h16l23 39 23-39h16L72 80v26H56V80L25 28Z";

function buildStandardSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Yonaris">
  <path fill="${BRAND_COLOR}" d="${STANDARD_Y_PATH}"/>
</svg>`;
}

function buildMaskableSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Yonaris">
  <rect width="128" height="128" rx="24" fill="${BRAND_LIGHT}"/>
  <path fill="${BRAND_COLOR}" d="${MASKABLE_Y_PATH}"/>
</svg>`;
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

function StandardIcon({ bg, size }: { bg?: string; size: number }) {
	return (
		<div tw="flex items-center justify-center w-full h-full" style={{ backgroundColor: bg ?? "transparent" }}>
			<svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Yonaris">
				<path fill={BRAND_COLOR} d={STANDARD_Y_PATH} />
			</svg>
		</div>
	);
}

function MaskableIcon({ size }: { size: number }) {
	return (
		<div tw="flex items-center justify-center w-full h-full" style={{ backgroundColor: BRAND_LIGHT }}>
			<svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="Yonaris">
				<path fill={BRAND_COLOR} d={MASKABLE_Y_PATH} />
			</svg>
		</div>
	);
}

mkdirSync(ICONS_DIR, { recursive: true });

const svgIcons = [
	{ name: "yonaris-icon.svg", contents: buildStandardSvg() },
	{ name: "yonaris-icon-maskable.svg", contents: buildMaskableSvg() },
];

for (const { name, contents } of svgIcons) {
	writeFileSync(resolve(ICONS_DIR, name), contents, "utf-8");
	console.log(`  ✓ icons/${name}`);
}

const iconPngs = [
	{ name: "yonaris-icon-96.png", element: <StandardIcon size={96} />, size: 96 },
	{ name: "yonaris-icon-192.png", element: <StandardIcon size={192} />, size: 192 },
	{ name: "yonaris-icon-512.png", element: <StandardIcon size={512} />, size: 512 },
	{ name: "yonaris-icon-maskable-192.png", element: <MaskableIcon size={192} />, size: 192 },
	{ name: "yonaris-icon-maskable-512.png", element: <MaskableIcon size={512} />, size: 512 },
];

for (const { name, element, size } of iconPngs) {
	writeFileSync(resolve(ICONS_DIR, name), await renderPng(element, size));
	console.log(`  ✓ icons/${name}`);
}

const appleTouch = await renderPng(<StandardIcon bg={BRAND_LIGHT} size={180} />, 180);
writeFileSync(resolve(PUBLIC_DIR, "apple-touch-icon.png"), appleTouch);
console.log("  ✓ apple-touch-icon.png");

const icoPngs: Buffer[] = [];
for (const size of [16, 32, 48]) {
	icoPngs.push(await renderPng(<StandardIcon size={size} />, size));
}
writeFileSync(resolve(PUBLIC_DIR, "favicon.ico"), await pngToIco(icoPngs));
console.log("  ✓ favicon.ico");

console.log(`\nIcons written to ${PUBLIC_DIR}`);
