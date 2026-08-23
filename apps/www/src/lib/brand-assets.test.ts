import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const requireFromPngToIco = createRequire(require.resolve("png-to-ico"));
const { PNG } = requireFromPngToIco("pngjs") as {
	PNG: { sync: { read(input: Buffer): { width: number; height: number; data: Buffer } } };
};

const EXPECTED_ALPHA_SHA256 = "163854fe1b2a0fba9c8fd8d1ac872eb6ae3b90a68081bfe41d02b3cf8dfbe2b1";
const appRoot = resolve(import.meta.dirname, "../..");

function inspectPng(relativePath: string) {
	const png = PNG.sync.read(readFileSync(resolve(appRoot, relativePath)));
	const alpha = Buffer.alloc(png.width * png.height);
	const opaqueRgb = new Set<string>();
	for (let offset = 0, pixel = 0; offset < png.data.length; offset += 4, pixel += 1) {
		alpha[pixel] = png.data[offset + 3];
		if (png.data[offset + 3] > 0) {
			opaqueRgb.add(`${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]}`);
		}
	}
	return {
		alphaHash: createHash("sha256").update(alpha).digest("hex"),
		height: png.height,
		opaqueRgb,
		width: png.width,
	};
}

describe("generated Yonaris brand assets", () => {
	test("preserves the approved wordmark alpha mask while recoloring only to Ink and Paper", () => {
		const ink = inspectPng("public/brand/logos/yonaris-wordmark-navy.png");
		const paper = inspectPng("public/brand/logos/yonaris-wordmark-white.png");

		for (const asset of [ink, paper]) {
			expect([asset.width, asset.height]).toEqual([278, 67]);
			expect(asset.alphaHash).toBe(EXPECTED_ALPHA_SHA256);
		}
		expect(ink.opaqueRgb).toEqual(new Set(["11,18,32"]));
		expect(paper.opaqueRgb).toEqual(new Set(["246,244,241"]));
	});

	test("publishes the exact VI palette and AI-native MarTech application identity", async () => {
		const modulePath = "./brand-assets";
		const subject = (await import(modulePath).catch(() => undefined)) as
			| { YONARIS_VI: Record<string, string> }
			| undefined;
		expect(subject, "brand-assets must be implemented").toBeDefined();
		if (!subject) return;

		expect(subject.YONARIS_VI).toEqual({
			ink: "#0B1220",
			paper: "#F6F4F1",
			slate: "#1E2A39",
			stone: "#8A95A3",
			mist: "#DDE2E8",
			signal: "#FF6A00",
			blueGray: "#2F3E50",
		});
		const manifest = JSON.parse(readFileSync(resolve(appRoot, "public/site.webmanifest"), "utf8"));
		expect(manifest.name).toBe("Yonaris — AI-native MarTech");
		expect(manifest.theme_color).toBe(subject.YONARIS_VI.ink);
		expect(manifest.background_color).toBe(subject.YONARIS_VI.paper);
	});
});
