import { existsSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ChinaApproachPage,
	ChinaDiagnosticPage,
	ChinaGeoPage,
	ChinaHomePage,
	ChinaProductPage,
} from "./china/china-pages";
import {
	GlobalApproachPage,
	GlobalDiagnosticPage,
	GlobalGeoPage,
	GlobalHomePage,
	GlobalProductPage,
} from "./global/global-pages";
import { CinematicField } from "./shared/cinematic-field";

const originalNames = ["decision-room", "glass-passage", "working-session"] as const;
const responsiveWidths = [640, 1024, 1440] as const;
const site06ImageRoot = new URL("../../../public/brand/site-06/", import.meta.url);
const publicOutputNormalizationLimit = 1_048_576;

describe("original Site 06 imagery", () => {
	it("ships full-resolution JPEG masters and no public stock-photo credit", () => {
		for (const file of ["decision-room-original.jpg", "glass-passage-original.jpg", "working-session-original.jpg"]) {
			expect(existsSync(new URL(`../../../public/brand/site-06/${file}`, import.meta.url))).toBe(true);
		}

		const markup = [GlobalHomePage(), GlobalGeoPage(), GlobalDiagnosticPage()]
			.map((page) => renderToStaticMarkup(page))
			.join("\n");
		expect(markup).not.toMatch(/Unsplash|Pexels|Photo:/i);
		expect(markup).toContain("/brand/site-06/decision-room-original.jpg");
		expect(markup).toContain('src="/brand/site-06/working-session-original.jpg"');
		for (const intrinsic of ['width="1535" height="1024"', 'width="1717" height="916"', 'width="1693" height="929"']) {
			expect(markup).toContain(intrinsic);
		}
	});

	it("keeps every Site 06 image within the public-output normalization limit and leaves no PNG masters", () => {
		const files = readdirSync(site06ImageRoot, { withFileTypes: true }).filter((entry) => entry.isFile());
		expect(files.filter(({ name }) => name.endsWith("-original.png"))).toEqual([]);
		for (const { name } of files) {
			expect(statSync(new URL(name, site06ImageRoot)).size, `${name} must not exceed 1 MiB`).toBeLessThanOrEqual(
				publicOutputNormalizationLimit,
			);
		}
	});

	it("ships high-quality responsive JPEG derivatives that are smaller than their full-resolution masters", () => {
		for (const name of originalNames) {
			const original = new URL(`../../../public/brand/site-06/${name}-original.jpg`, import.meta.url);
			for (const width of responsiveWidths) {
				const derivative = new URL(`../../../public/brand/site-06/${name}-${width}.jpg`, import.meta.url);
				expect(existsSync(derivative), `${name}-${width}.jpg must exist`).toBe(true);
				expect(
					statSync(derivative).size,
					`${name}-${width}.jpg must be smaller than its full-resolution master`,
				).toBeLessThan(statSync(original).size);
			}
		}
	});

	it("serves every routed original through a responsive picture while retaining the JPEG master fallback", () => {
		const routedMarkup = [
			<GlobalHomePage key="en-home" />,
			<GlobalProductPage key="en-product" />,
			<GlobalApproachPage key="en-approach" />,
			<GlobalGeoPage key="en-geo" />,
			<GlobalDiagnosticPage key="en-diagnostic" />,
			<ChinaHomePage key="zh-home" />,
			<ChinaProductPage key="zh-product" />,
			<ChinaApproachPage key="zh-approach" />,
			<ChinaGeoPage key="zh-geo" />,
			<ChinaDiagnosticPage key="zh-diagnostic" />,
		]
			.map((page) => renderToStaticMarkup(page))
			.join("\n");
		const originalFallbacks =
			routedMarkup.match(/src="\/brand\/site-06\/(?:decision-room|glass-passage|working-session)-original\.jpg"/g) ??
			[];
		expect(originalFallbacks).toHaveLength(12);
		expect(routedMarkup).not.toContain("-original.png");
		expect(routedMarkup.match(/<picture data-responsive-site-06-image="true">/g) ?? []).toHaveLength(
			originalFallbacks.length,
		);
		expect(routedMarkup.match(/<source type="image\/jpeg"/g) ?? []).toHaveLength(originalFallbacks.length);
		for (const name of originalNames) {
			expect(routedMarkup).toContain(
				`srcSet="/brand/site-06/${name}-640.jpg 640w, /brand/site-06/${name}-1024.jpg 1024w, /brand/site-06/${name}-1440.jpg 1440w"`,
			);
		}
		expect(routedMarkup).toContain('sizes="(max-width: 720px) 100vw, (max-width: 1440px) 100vw, 1440px"');
		expect(routedMarkup).toContain('sizes="(max-width: 880px) 100vw, 50vw"');
	});

	it("eagerly loads only an explicitly prioritized cinematic image", () => {
		const priorityMarkup = renderToStaticMarkup(
			<CinematicField
				image={{
					src: "/brand/site-06/decision-room-original.jpg",
					alt: "Decision room",
					width: 1535,
					height: 1024,
				}}
				priority
			>
				<p>First viewport</p>
			</CinematicField>,
		);
		const deferredMarkup = renderToStaticMarkup(
			<CinematicField image={{ src: "/brand/site-06/glass-passage-original.jpg", alt: "Glass passage" }}>
				<p>Later viewport</p>
			</CinematicField>,
		);

		expect(priorityMarkup).toContain('loading="eager"');
		expect(priorityMarkup).toContain('fetchPriority="high"');
		expect(priorityMarkup).toContain('decoding="async"');
		expect(priorityMarkup).toContain('width="1535" height="1024"');
		expect(priorityMarkup).toContain('<picture data-responsive-site-06-image="true">');
		expect(priorityMarkup).toContain('<source type="image/jpeg"');
		expect(deferredMarkup).toContain('loading="lazy"');
	});
});
