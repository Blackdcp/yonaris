#!/usr/bin/env tsx
/**
 * Generates the Yonaris brand kit as a zip of PNGs using Satori + resvg (JSX → PNG).
 *
 * Output: apps/web/yonaris-brand-kit.zip
 *
 *   Icons (square Y monogram):
 *     yonaris-icon-{size}.png              Transparent background
 *     yonaris-icon-white-{size}.png        Warm-white background
 *     yonaris-icon-dark-{size}.png         Dark background
 *     yonaris-icon-maskable-{size}.png     Maskable/PWA
 *
 *   Logos (official Yonaris wordmark, sm/md/lg × 3 backgrounds):
 *     yonaris-logo[-white|-dark]-{sm|md|lg}.png
 *
 *   OG images (1200×630):
 *     og-default.png                    Default Open Graph image
 *
 *   Social banners:
 *     twitter-banner.png                3000×1000 (Twitter/X header)
 *     linkedin-banner.png               3384×573 (LinkedIn personal)
 *
 * Usage:
 *   pnpm --filter @workspace/web generate-brand-kit
 */
import { createWriteStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_BRAND_COLOR, YONARIS_COLORS } from "@workspace/config/constants";
import { renderOgPng } from "@workspace/og/rasterize";
import { ZipArchive } from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const BRAND_COLOR = DEFAULT_BRAND_COLOR;
const BACKGROUND_COLOR = DEFAULT_BACKGROUND_COLOR;
const ACCENT_COLORS = [BRAND_COLOR, YONARIS_COLORS.slate, YONARIS_COLORS.signal, BACKGROUND_COLOR];
const TAGLINE = "AI answer evidence";
const DESCRIPTION = "Track and optimize your brand's visibility across AI models.";
const OUTPUT_ZIP = resolve(__dirname, "../yonaris-brand-kit.zip");
const STANDARD_PATH = "M1 1h13l15 26L44 1h13L35 38v25H23V38L1 1Z";
const MASKABLE_PATH = "M25 28h16l23 39 23-39h16L72 80v26H56V80L25 28Z";

function loadPngDataUri(path: string): string {
	return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

const NAVY_WORDMARK = loadPngDataUri(resolve(__dirname, "../public/brand/yonaris-wordmark-navy.png"));
const WHITE_WORDMARK = loadPngDataUri(resolve(__dirname, "../public/brand/yonaris-wordmark-white.png"));

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

function loadFont(path: string): ArrayBuffer {
	const buf = readFileSync(require.resolve(path));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const fonts = [
	{
		name: "Geist Sans",
		data: loadFont("@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff"),
		style: "normal" as const,
		weight: 400 as const,
	},
	{
		name: "Geist Sans",
		data: loadFont("@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff"),
		style: "normal" as const,
		weight: 500 as const,
	},
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function render(element: React.ReactElement, width: number, height: number): Promise<Buffer> {
	return Buffer.from(await renderOgPng(element, { width, height, fonts }));
}

// ---------------------------------------------------------------------------
// Icon — Y monogram scaled to fill the canvas
// ---------------------------------------------------------------------------

function Icon({ fill, bg, size }: { fill: string; bg?: string; size: number }) {
	return (
		<div tw="flex items-center justify-center w-full h-full" style={{ backgroundColor: bg || "transparent" }}>
			<svg viewBox="0 0 64 64" width={size} height={size}>
				<title>Yonaris Y icon</title>
				<path fill={fill} d={STANDARD_PATH} />
			</svg>
		</div>
	);
}

function MaskableIcon({ size }: { size: number }) {
	return (
		<svg viewBox="0 0 128 128" width={size} height={size}>
			<title>Yonaris maskable icon</title>
			<rect width="128" height="128" rx="24" fill={BACKGROUND_COLOR} />
			<path fill={BRAND_COLOR} d={MASKABLE_PATH} />
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Logo — official wordmark with equal padding on all sides
// ---------------------------------------------------------------------------

function Logo({ bg, fontSize }: { bg?: string; fontSize: number }) {
	const src = bg === "#111827" ? WHITE_WORDMARK : NAVY_WORDMARK;
	return (
		<div tw="flex items-center justify-center w-full h-full" style={{ backgroundColor: bg || "transparent" }}>
			<img
				src={src}
				alt="Yonaris"
				style={{
					width: Math.round(fontSize * 2.6),
					height: fontSize,
					objectFit: "contain",
				}}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// PatternBanner — repeating Yonaris wordmark at an angle.
// ---------------------------------------------------------------------------

function PatternBanner({
	width,
	height,
	bg,
	colors,
	angle,
	fontScale,
}: {
	width: number;
	height: number;
	bg: string;
	colors: readonly string[];
	angle: number;
	fontScale: number;
}) {
	const fontSize = Math.round(height * fontScale);
	const wordWidth = Math.round(fontSize * 3.8);
	const gap = Math.round(fontSize * 0.5);
	const cellWidth = wordWidth + gap;
	const rowHeight = Math.round(fontSize * 1.5);

	const diagonal = Math.ceil(Math.sqrt(width * width + height * height));
	const gridSize = Math.round(diagonal * 1.5);

	const cols = Math.ceil(gridSize / cellWidth) + 2;
	const rows = Math.ceil(gridSize / rowHeight) + 2;

	const offsetX = -Math.round((gridSize - width) / 2);
	const offsetY = -Math.round((gridSize - height) / 2);

	const rowElements: React.ReactElement[] = [];
	for (let r = 0; r < rows; r++) {
		const cells: React.ReactElement[] = [];
		const brickOffset = r % 2 === 0 ? 0 : Math.round(cellWidth * 0.5);
		for (let c = 0; c < cols; c++) {
			const colorIdx = (r * 3 + c) % colors.length;
			cells.push(
				<div
					style={{
						fontFamily: "Geist Sans",
						fontWeight: 500,
						fontSize,
						color: colors[colorIdx],
						lineHeight: 1,
						marginRight: gap,
					}}
				>
					Yonaris
				</div>,
			);
		}
		rowElements.push(
			<div
				style={{
					display: "flex",
					marginLeft: brickOffset,
					height: rowHeight,
					alignItems: "center",
				}}
			>
				{cells}
			</div>,
		);
	}

	return (
		<div tw="flex w-full h-full relative overflow-hidden" style={{ backgroundColor: bg, opacity: 0.99 }}>
			<div
				style={{
					position: "absolute",
					display: "flex",
					flexDirection: "column",
					transform: `rotate(${angle}deg)`,
					left: offsetX,
					top: offsetY,
					width: gridSize,
					height: gridSize,
				}}
			>
				{rowElements}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// OG image
// ---------------------------------------------------------------------------

function OgImage({ title }: { title: string }) {
	return (
		<div tw="flex w-full h-full relative overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
			<div
				style={{
					position: "absolute",
					fontFamily: "Geist Sans",
					fontWeight: 500,
					fontSize: 700,
					color: "rgba(11,18,32,0.04)",
					lineHeight: 1,
					right: -60,
					top: -60,
				}}
			>
				Y
			</div>

			<div tw="flex flex-col justify-center h-full" style={{ paddingLeft: 80, paddingRight: 80 }}>
				<img
					src={NAVY_WORDMARK}
					alt="Yonaris"
					width={310}
					height={75}
					style={{ objectFit: "contain", marginBottom: 28 }}
				/>
				<div
					style={{
						fontFamily: "Geist Sans",
						fontSize: 44,
						fontWeight: 500,
						color: "#1e293b",
						marginBottom: 16,
					}}
				>
					{title}
				</div>
				<div style={{ fontFamily: "Geist Sans", fontSize: 24, color: "#64748b" }}>{DESCRIPTION}</div>
			</div>

			<div
				style={{
					display: "flex",
					position: "absolute",
					bottom: 0,
					left: 0,
					width: "100%",
					height: 6,
					backgroundImage: `linear-gradient(to right, ${ACCENT_COLORS.join(", ")})`,
				}}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Generate all assets
// ---------------------------------------------------------------------------

const files: { name: string; data: Buffer }[] = [];

async function addFile(name: string, data: Buffer | Promise<Buffer>) {
	const resolved = await data;
	files.push({ name, data: resolved });
	console.log(`  ✓ ${name}`);
}

console.log("Generating Yonaris brand kit…\n");

// Icons — always brand blue, bg varies
const iconVariants = [
	{ suffix: "", bg: undefined },
	{ suffix: "-white", bg: BACKGROUND_COLOR },
	{ suffix: "-dark", bg: "#111827" },
];
const iconSizes = [16, 32, 64, 128, 256, 512];

console.log("Icons:");
for (const v of iconVariants) {
	for (const size of iconSizes) {
		await addFile(
			`icons/yonaris-icon${v.suffix}-${size}.png`,
			render(<Icon fill={BRAND_COLOR} bg={v.bg} size={size} />, size, size),
		);
	}
}

console.log("\nIcons — Maskable (PWA):");
for (const size of [64, 128, 256, 512]) {
	await addFile(`icons/yonaris-icon-maskable-${size}.png`, render(<MaskableIcon size={size} />, size, size));
}

// Logos — always brand blue text
console.log("\nLogos:");
const logoBgs = [
	{ suffix: "", bg: undefined },
	{ suffix: "-white", bg: BACKGROUND_COLOR },
	{ suffix: "-dark", bg: "#111827" },
];
const logoSizes = [
	{ label: "sm", fontSize: 64, w: 190, h: 90 },
	{ label: "md", fontSize: 100, w: 290, h: 140 },
	{ label: "lg", fontSize: 160, w: 470, h: 220 },
	{ label: "xl", fontSize: 240, w: 700, h: 330 },
	{ label: "2xl", fontSize: 360, w: 1050, h: 500 },
];
for (const bg of logoBgs) {
	for (const sz of logoSizes) {
		await addFile(
			`logos/yonaris-logo${bg.suffix}-${sz.label}.png`,
			render(<Logo bg={bg.bg} fontSize={sz.fontSize} />, sz.w, sz.h),
		);
	}
}

// OG
console.log("\nOG Images:");
const ogData = await render(<OgImage title={TAGLINE} />, 1200, 630);
files.push({ name: "og/og-default.png", data: ogData });
console.log("  ✓ og/og-default.png  (1200×630)");

// Banners — wrapping-paper style, wildly different per platform
console.log("\nSocial Banners:");

const sharedBannerStyle = {
	bg: BACKGROUND_COLOR,
	colors: [
		BRAND_COLOR,
		YONARIS_COLORS.slate,
		YONARIS_COLORS.blueGray,
		YONARIS_COLORS.stone,
		YONARIS_COLORS.signal,
		YONARIS_COLORS.paper,
	],
	angle: 15,
} as const;

await addFile(
	"banners/twitter-banner.png",
	render(<PatternBanner width={3000} height={1000} {...sharedBannerStyle} fontScale={0.105} />, 3000, 1000),
);

await addFile(
	"banners/linkedin-banner.png",
	render(<PatternBanner width={3384} height={573} {...sharedBannerStyle} fontScale={0.18} />, 3384, 573),
);

// Write zip
console.log("\nPacking zip…");

const output = createWriteStream(OUTPUT_ZIP);
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = new Promise<void>((res, rej) => {
	output.on("close", res);
	archive.on("error", rej);
});

archive.pipe(output);

for (const file of files) {
	archive.append(file.data, { name: file.name });
}

await archive.finalize();
await done;

const zipSize = readFileSync(OUTPUT_ZIP).length;
const kb = (zipSize / 1024).toFixed(1);
console.log(`\n✅ yonaris-brand-kit.zip (${kb} KB, ${files.length} files) → ${OUTPUT_ZIP}`);
