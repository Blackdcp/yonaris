#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOgPng } from "@workspace/og/rasterize";
import pngToIco from "png-to-ico";
import React from "react";
/**
 * Generates favicon and PWA icon assets for the Yonaris marketing site.
 *
 * Output directories:
 *   - apps/www/public/       favicon.ico, apple-touch-icon.png
 *   - apps/www/public/icons/ yonaris icon SVG and PNG variants
 *
 * Approved wordmark geometry is preserved as an alpha mask. Generation only
 * recolors its existing pixels to the current Ink and Paper tokens.
 *
 * Usage:
 *   pnpm -F @workspace/www generate-icons
 */
import { recolorRgbaAlphaMask, YONARIS_VI } from "../src/lib/brand-assets";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const requireFromPngToIco = createRequire(require.resolve("png-to-ico"));
const { PNG } = requireFromPngToIco("pngjs") as {
	PNG: {
		sync: {
			read(input: Buffer): { width: number; height: number; data: Buffer };
			write(input: { width: number; height: number; data: Buffer }): Buffer;
		};
	};
};

const BRAND_COLOR = YONARIS_VI.ink;
const BRAND_LIGHT = YONARIS_VI.paper;
const PUBLIC_DIR = resolve(__dirname, "../public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");
const WORDMARK_DIR = resolve(PUBLIC_DIR, "brand/logos");

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
mkdirSync(WORDMARK_DIR, { recursive: true });

const approvedWordmark = PNG.sync.read(readFileSync(resolve(WORDMARK_DIR, "yonaris-wordmark-navy.png")));
for (const [filename, color] of [
	["yonaris-wordmark-navy.png", YONARIS_VI.ink],
	["yonaris-wordmark-white.png", YONARIS_VI.paper],
] as const) {
	const pixels = Buffer.from(approvedWordmark.data);
	recolorRgbaAlphaMask(pixels, color);
	writeFileSync(
		resolve(WORDMARK_DIR, filename),
		PNG.sync.write({ width: approvedWordmark.width, height: approvedWordmark.height, data: pixels }),
	);
	console.log(`  ✓ brand/logos/${filename}`);
}

const svgIcons = [
	{ name: "yonaris-icon.svg", contents: buildStandardSvg() },
	{ name: "yonaris-icon-maskable.svg", contents: buildMaskableSvg() },
];

for (const { name, contents } of svgIcons) {
	writeFileSync(resolve(ICONS_DIR, name), contents, "utf-8");
	console.log(`  ✓ icons/${name}`);
}

const iconPngs = [
	{ name: "yonaris-icon-96.png", element: React.createElement(StandardIcon, { size: 96 }), size: 96 },
	{ name: "yonaris-icon-192.png", element: React.createElement(StandardIcon, { size: 192 }), size: 192 },
	{ name: "yonaris-icon-512.png", element: React.createElement(StandardIcon, { size: 512 }), size: 512 },
	{ name: "yonaris-icon-maskable-192.png", element: React.createElement(MaskableIcon, { size: 192 }), size: 192 },
	{ name: "yonaris-icon-maskable-512.png", element: React.createElement(MaskableIcon, { size: 512 }), size: 512 },
];

for (const { name, element, size } of iconPngs) {
	writeFileSync(resolve(ICONS_DIR, name), await renderPng(element, size));
	console.log(`  ✓ icons/${name}`);
}

const appleTouch = await renderPng(React.createElement(StandardIcon, { bg: BRAND_LIGHT, size: 180 }), 180);
writeFileSync(resolve(PUBLIC_DIR, "apple-touch-icon.png"), appleTouch);
console.log("  ✓ apple-touch-icon.png");

const icoPngs: Buffer[] = [];
for (const size of [16, 32, 48]) {
	icoPngs.push(await renderPng(React.createElement(StandardIcon, { size }), size));
}
writeFileSync(resolve(PUBLIC_DIR, "favicon.ico"), await pngToIco(icoPngs));
console.log("  ✓ favicon.ico");

console.log(`\nIcons written to ${PUBLIC_DIR}`);
