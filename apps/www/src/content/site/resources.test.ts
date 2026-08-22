import { describe, expect, test } from "vitest";
import { getSiteRoute } from "@/lib/site-manifest";
import * as resourcesModule from "./resources";

type OpenSourceGetter = () => {
	meta: { title: string; description: string };
	eyebrow: string;
	headline: string;
	introduction: string;
	currentScope: string;
	relationship: {
		title: string;
		items: readonly { id: string; label: string; description: string }[];
	};
	compatibility: {
		title: string;
		introduction: string;
		identifiers: readonly { id: string; label: string; values: readonly string[] }[];
	};
	sources: readonly { id: string; label: string; href: string; external: boolean }[];
	claims: readonly { id: string; status: string; text: string; limitation?: string }[];
	limitations: readonly string[];
};

const getOpenSourceContent = (
	resourcesModule as typeof resourcesModule & {
		getOpenSourceContent?: OpenSourceGetter;
	}
).getOpenSourceContent;

describe("supporting resource content", () => {
	test("publishes one English editorial index with the six approved destinations", () => {
		const content = resourcesModule.getResourcesContent("en") as ReturnType<
			typeof resourcesModule.getResourcesContent
		> & {
			eyebrow?: string;
			headline?: string;
			introduction?: string;
			indexLabel?: string;
		};

		expect(content).toMatchObject({
			eyebrow: "Company resources",
			headline: "A field index for reading the market.",
			indexLabel: "Six places to go deeper",
		});
		expect(content.introduction).toMatch(/research, technical context, and company materials/i);
		expect(content.items.map(({ id, path }) => ({ id, path }))).toEqual([
			{ id: "research", path: "/research" },
			{ id: "docs", path: "/docs" },
			{ id: "glossary", path: "/glossary" },
			{ id: "status", path: "/status" },
			{ id: "brand", path: "/brand" },
			{ id: "open-source", path: "/open-source" },
		]);
		expect(new Set(content.items.map(({ id }) => id)).size).toBe(6);
		expect(content.items.every(({ label, description }) => label.trim() && description.trim())).toBe(true);
	});

	test("keeps Resources and Open Source English-only in the site manifest", () => {
		expect(getSiteRoute("resources").canonicals).toEqual({ en: "/resources" });
		expect(getSiteRoute("openSource").canonicals).toEqual({ en: "/open-source" });
	});

	test("states the verified Yonaris and upstream relationship without identity drift", () => {
		expect(getOpenSourceContent, "Open Source needs a typed factual content source").toBeTypeOf("function");
		if (!getOpenSourceContent) return;

		const content = getOpenSourceContent();
		expect(content).toMatchObject({
			eyebrow: "Open-source infrastructure",
			headline: "Infrastructure, not identity.",
		});
		expect(content.introduction).toMatch(/uses and extends Elmo-compatible infrastructure/i);
		expect(content.introduction).toMatch(/MIT License/i);
		expect(content.currentScope).toMatch(/technical foundation/i);
		expect(content.currentScope).toMatch(/does not define the Yonaris company/i);
		expect(content.relationship.items.map(({ id }) => id)).toEqual(["yonaris", "upstream", "boundary"]);
		expect(content.relationship.items.find(({ id }) => id === "upstream")?.description).toMatch(
			/upstream open-source project/i,
		);
		expect(content.relationship.items.find(({ id }) => id === "boundary")?.description).toMatch(
			/not a Yonaris product promise/i,
		);
	});

	test("records only the compatibility identifiers verified in the repository", () => {
		expect(getOpenSourceContent).toBeTypeOf("function");
		if (!getOpenSourceContent) return;

		expect(getOpenSourceContent().compatibility.identifiers).toEqual([
			{ id: "package", label: "npm package", values: ["@elmohq/cli"] },
			{ id: "command", label: "CLI command", values: ["elmo"] },
			{ id: "config", label: "Configuration", values: ["~/.elmo", "elmo.yaml"] },
			{ id: "images", label: "Docker images", values: ["elmohq/elmo-*"] },
			{
				id: "encryption",
				label: "Encryption variables",
				values: ["ELMO_ENCRYPTION_KEY", "ELMO_ENCRYPTION_KEY_OLD"],
			},
		]);
	});

	test("links only the verified repository, upstream, license, and documentation surfaces", () => {
		expect(getOpenSourceContent).toBeTypeOf("function");
		if (!getOpenSourceContent) return;

		expect(getOpenSourceContent().sources).toEqual([
			{
				id: "repository",
				label: "Yonaris repository",
				href: "https://github.com/Blackdcp/yonaris",
				external: true,
			},
			{
				id: "upstream",
				label: "Elmo upstream",
				href: "https://github.com/elmohq/elmo",
				external: true,
			},
			{
				id: "license",
				label: "MIT license notice",
				href: "https://github.com/Blackdcp/yonaris/blob/main/LICENSE.md",
				external: true,
			},
			{ id: "docs", label: "Open-source documentation", href: "/docs", external: false },
		]);
	});

	test("avoids fabricated project proof, roadmap claims, and new legal conclusions", () => {
		expect(getOpenSourceContent).toBeTypeOf("function");
		if (!getOpenSourceContent) return;

		const content = getOpenSourceContent();
		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/\bstars?\b|\busers?\b|roadmap|funding|investors?|certification/i);
		expect(serialized).not.toMatch(/warrant(?:y|ies)|liabilit(?:y|ies)|legal advice|compliance guarantee/i);
		expect(content.claims.every(({ limitation }) => Boolean(limitation?.trim()))).toBe(true);
		expect(new Set(content.claims.map(({ id }) => id)).size).toBe(content.claims.length);
	});
});
