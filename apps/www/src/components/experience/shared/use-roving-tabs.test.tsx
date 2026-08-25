import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	AnswerFieldScene,
	ChangePathScene,
	CompanyConstellationScene,
	MarketAtlasScene,
	ProductLensScene,
} from "../global/global-scenes";
import { resolveRovingTabIndex } from "./use-roving-tabs";

function attribute(markup: string, name: string): string | undefined {
	return markup.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function expectLinkedTabSet(markup: string, expectedCount: number) {
	const tabs = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => tab);
	const panels = [...markup.matchAll(/<(?:article|section)[^>]*role="tabpanel"[^>]*>/g)].map(([panel]) => panel);

	expect(tabs).toHaveLength(expectedCount);
	expect(panels).toHaveLength(expectedCount);

	const tabIds = tabs.map((tab) => attribute(tab, "id"));
	expect(tabIds.every(Boolean)).toBe(true);
	expect(new Set(tabIds).size).toBe(expectedCount);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "0")).toHaveLength(1);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "-1")).toHaveLength(expectedCount - 1);

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

describe("Global roving tab scenes", () => {
	it.each([
		["answer field", AnswerFieldScene, 5],
		["product journey", ProductLensScene, 4],
		["approach path", ChangePathScene, 4],
		["market lenses", MarketAtlasScene, 3],
		["company boundaries", CompanyConstellationScene, 4],
	] as const)("links every %s tab to one labelled panel", (_name, Scene, count) => {
		expectLinkedTabSet(renderToStaticMarkup(<Scene />), count);
	});

	it("keeps tab and panel IDs unique across multiple instances", () => {
		const markup = renderToStaticMarkup(
			<>
				<ProductLensScene />
				<ProductLensScene />
			</>,
		);
		const tabIds = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => attribute(tab, "id"));
		const panelIds = [...markup.matchAll(/<section[^>]*role="tabpanel"[^>]*>/g)].map(([panel]) =>
			attribute(panel, "id"),
		);

		expect(tabIds).toHaveLength(8);
		expect(panelIds).toHaveLength(8);
		expect(new Set(tabIds).size).toBe(8);
		expect(new Set(panelIds).size).toBe(8);
	});
});
