import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalDiagnosticPage, GlobalGeoPage, GlobalHomePage } from "./global/global-pages";
import { CinematicField } from "./shared/cinematic-field";

describe("original Site 06 imagery", () => {
	it("ships original assets and no public stock-photo credit", () => {
		for (const file of ["decision-room-original.png", "glass-passage-original.png", "working-session-original.png"]) {
			expect(existsSync(new URL(`../../../public/brand/site-06/${file}`, import.meta.url))).toBe(true);
		}

		const markup = [GlobalHomePage(), GlobalGeoPage(), GlobalDiagnosticPage()]
			.map((page) => renderToStaticMarkup(page))
			.join("\n");
		expect(markup).not.toMatch(/Unsplash|Pexels|Photo:/i);
		expect(markup).toContain("/brand/site-06/decision-room-original.png");
	});

	it("eagerly loads only an explicitly prioritized cinematic image", () => {
		const priorityMarkup = renderToStaticMarkup(
			<CinematicField image={{ src: "/brand/site-06/decision-room-original.png", alt: "Decision room" }} priority>
				<p>First viewport</p>
			</CinematicField>,
		);
		const deferredMarkup = renderToStaticMarkup(
			<CinematicField image={{ src: "/brand/site-06/glass-passage-original.png", alt: "Glass passage" }}>
				<p>Later viewport</p>
			</CinematicField>,
		);

		expect(priorityMarkup).toContain('loading="eager"');
		expect(priorityMarkup).toContain('fetchPriority="high"');
		expect(priorityMarkup).toContain('decoding="async"');
		expect(deferredMarkup).toContain('loading="lazy"');
	});
});
