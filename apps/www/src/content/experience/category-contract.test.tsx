import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChinaHomePage } from "@/components/experience/china/china-pages";
import { GlobalHomePage } from "@/components/experience/global/global-pages";
import { buildAgentEntityGraph } from "@/lib/machine-documents";
import { organizationJsonLd, SITE_DESCRIPTION } from "@/lib/seo";
import * as canonicalFacts from "./canonical-public-facts";
import { CHINA_COPY } from "./china-copy";
import { GLOBAL_COPY } from "./global-copy";

const EXACT_EN_CATEGORY = "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
const EXACT_ZH_CATEGORY = "面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。";

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) return sourceFiles(path);
		if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
		return [path];
	});
}

describe("canonical category contract", () => {
	it("reuses the exact approved category across Human, footer, SEO and machine surfaces", () => {
		const categoryModule = canonicalFacts as typeof canonicalFacts & {
			EN_CATEGORY?: string;
			ZH_CATEGORY?: string;
		};
		expect(categoryModule.EN_CATEGORY).toBe(EXACT_EN_CATEGORY);
		expect(categoryModule.ZH_CATEGORY).toBe(EXACT_ZH_CATEGORY);
		expect(GLOBAL_COPY.home.eyebrow).toBe(categoryModule.EN_CATEGORY);
		expect(CHINA_COPY.home.eyebrow).toBe(categoryModule.ZH_CATEGORY);
		expect(canonicalFacts.EN_READING_RECORDS[0].fact).toBe(categoryModule.EN_CATEGORY);
		expect(canonicalFacts.ZH_READING_RECORDS[0].fact).toBe(categoryModule.ZH_CATEGORY);

		const enHome = renderToStaticMarkup(<GlobalHomePage />);
		const zhHome = renderToStaticMarkup(<ChinaHomePage />);
		const enFooter = enHome.match(/<footer[^>]*>[\s\S]*?<\/footer>/)?.[0] ?? "";
		const zhFooter = zhHome.match(/<footer[^>]*>[\s\S]*?<\/footer>/)?.[0] ?? "";
		expect(enFooter).toContain(categoryModule.EN_CATEGORY);
		expect(zhFooter).toContain(categoryModule.ZH_CATEGORY);
		expect(SITE_DESCRIPTION).toBe(categoryModule.EN_CATEGORY);
		expect(JSON.parse(organizationJsonLd().children).description).toBe(categoryModule.EN_CATEGORY);
		const organization = buildAgentEntityGraph("en", ["home"], (path) => path).find(
			(node) => node["@type"] === "Organization",
		);
		expect(organization && "description" in organization ? organization.description : undefined).toBe(
			categoryModule.EN_CATEGORY,
		);
		const zhOrganization = buildAgentEntityGraph("zh", ["home"], (path) => path).find(
			(node) => node["@type"] === "Organization",
		);
		expect(zhOrganization && "description" in zhOrganization ? zhOrganization.description : undefined).toBe(
			categoryModule.ZH_CATEGORY,
		);
	});

	it("keeps each approved category literal in one production source module", () => {
		const src = fileURLToPath(new URL("../../", import.meta.url));
		const productionSources = sourceFiles(src).map((path) => ({ path, source: readFileSync(path, "utf8") }));
		for (const literal of [EXACT_EN_CATEGORY, EXACT_ZH_CATEGORY]) {
			const owners = productionSources.filter(({ source }) => source.includes(literal)).map(({ path }) => path);
			expect(owners).toEqual([expect.stringMatching(/canonical-public-facts\.ts$/)]);
		}
	});
});
