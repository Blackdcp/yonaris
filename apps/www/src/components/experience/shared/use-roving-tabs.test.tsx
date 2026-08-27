import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	CompanyReadingScene,
	EvidenceReviewScene,
	HomeReadingScene,
	PlatformInspectorScene,
} from "../global/global-scenes";
import { resolveRovingTabIndex } from "./use-roving-tabs";

function attribute(markup: string, name: string): string | undefined {
	return markup.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function expectLinkedTabSet(markup: string, expectedCount: number, expectedTabsets = 1) {
	const tabs = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => tab);
	const panels = [...markup.matchAll(/<(?:article|section)[^>]*role="tabpanel"[^>]*>/g)].map(([panel]) => panel);

	expect(tabs).toHaveLength(expectedCount);
	expect(panels).toHaveLength(expectedCount);

	const tabIds = tabs.map((tab) => attribute(tab, "id"));
	expect(tabIds.every(Boolean)).toBe(true);
	expect(new Set(tabIds).size).toBe(expectedCount);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "0")).toHaveLength(expectedTabsets);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "-1")).toHaveLength(expectedCount - expectedTabsets);

	for (const panel of panels) {
		const panelId = attribute(panel, "id");
		const labelledBy = attribute(panel, "aria-labelledby");
		expect(panelId).toBeDefined();
		expect(labelledBy).toBeDefined();
		expect(tabIds).toContain(labelledBy);
		expect(tabs.some((tab) => attribute(tab, "aria-controls") === panelId)).toBe(true);
	}
}

describe("resolveRovingTabIndex", () => {
	it.each([
		["ArrowLeft", 0, 3],
		["ArrowLeft", 2, 1],
		["ArrowRight", 1, 2],
		["ArrowRight", 3, 0],
		["Home", 3, 0],
		["End", 0, 3],
	] as const)("resolves %s from index %i to index %i", (key, current, expected) => {
		expect(resolveRovingTabIndex(4, current, key)).toBe(expected);
	});
});

describe("Site 06 English roving tab scenes", () => {
	it.each([
		["home fixed-claim reading", HomeReadingScene, 2, 1],
		["platform evidence", PlatformInspectorScene, 3, 1],
		["evidence review", EvidenceReviewScene, 2, 1],
		["company facts", CompanyReadingScene, 9, 4],
	] as const)("links every %s tab to one labelled panel", (_name, Scene, count, tabsets) => {
		expectLinkedTabSet(renderToStaticMarkup(<Scene />), count, tabsets);
	});

	it("keeps tab and panel IDs unique across multiple instances", () => {
		const markup = renderToStaticMarkup(
			<>
				<PlatformInspectorScene />
				<PlatformInspectorScene />
			</>,
		);
		const tabIds = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => attribute(tab, "id"));
		const panelIds = [...markup.matchAll(/<(?:article|section)[^>]*role="tabpanel"[^>]*>/g)].map(([panel]) =>
			attribute(panel, "id"),
		);

		expect(tabIds).toHaveLength(6);
		expect(panelIds).toHaveLength(6);
		expect(new Set(tabIds).size).toBe(6);
		expect(new Set(panelIds).size).toBe(6);
	});
});
