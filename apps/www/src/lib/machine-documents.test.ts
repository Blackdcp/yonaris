import { describe, expect, test } from "vitest";
import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { HUMAN_PAGE_KEYS } from "@/content/experience/types";
import type { AgentPageKey } from "@/content/site/types";
import type { MachineLinkSet } from "./machine-response";
import * as machineDocumentsModule from "./machine-documents";
import {
	agentCatalogPath,
	agentMarkdownPath,
	getAgentTopic,
	renderAgentDocument,
	renderAgentCatalog,
	renderAgentIndex,
	renderCoreMarkdown,
	renderLlmsFull,
	renderLlmsIndex,
	renderZhAgentDocument,
	renderZhAgentIndex,
} from "./machine-documents";

const agentKeys = HUMAN_PAGE_KEYS.filter((key): key is AgentPageKey => key !== "home");

const machineLinkHelpers = machineDocumentsModule as typeof machineDocumentsModule &
	Partial<{
		agentDocumentLinks(locale: "en" | "zh", key: (typeof HUMAN_PAGE_KEYS)[number]): MachineLinkSet;
		agentCatalogLinks(locale: "en" | "zh"): MachineLinkSet;
	}>;

describe("machine documents", () => {
	test("publishes a stable typed catalogue for every locale and Human topic", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				const topic = getAgentTopic(locale, key);
				expect(topic.id).toBe(`${locale}.${key}`);
				expect(topic.locale).toBe(locale);
				expect(topic.language).toBe(locale === "en" ? "en" : "zh-CN");
				expect(topic.summary.trim()).not.toBe("");
				expect(topic.humanPath).toBe(
					key === "home" ? (locale === "zh" ? "/zh" : "/") : `/${locale === "zh" ? "zh/" : ""}${key}`,
				);
				expect(topic.agentPath).toBe(
					key === "home" ? `/${locale === "zh" ? "zh/" : ""}agent` : `/${locale === "zh" ? "zh/" : ""}agent/${key}`,
				);
				const localePrefix = locale === "zh" ? "/zh" : "";
				expect(topic.markdownPath).toBe(
					key === "home" ? `${localePrefix}/agent/index.md` : `${localePrefix}/agent/${key}.md`,
				);
				expect(topic.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(topic.reviewedBy).toBe("Yonaris");
				expect(topic.scope.length).toBeGreaterThan(20);
				expect(topic.limitations.length).toBeGreaterThan(0);
				for (const group of topic.groups) {
					expect(group.id).toMatch(/^[a-z0-9.-]+$/);
					for (const fact of group.facts) {
						expect(fact.id).toMatch(new RegExp(`^${key}\\.`));
						expect(fact.value.trim()).not.toBe("");
						expect(fact.evidenceUrl).toBe(topic.humanPath);
					}
				}
			}
		}
	});

	test("renders equivalent Markdown and JSON-LD from stable catalogue claims", () => {
		for (const locale of ["en", "zh"] as const) {
			const catalogue = JSON.parse(renderAgentCatalog(locale));
			expect(agentCatalogPath(locale)).toBe(locale === "en" ? "/agent/catalog.json" : "/zh/agent/catalog.json");
			expect(catalogue["@context"]).toBe("https://schema.org");
			expect(catalogue["@graph"].map((node: { "@type": string }) => node["@type"])).toContain("Organization");
			expect(catalogue["@graph"].filter((node: { "@type": string }) => node["@type"] === "ItemList")).toHaveLength(
				HUMAN_PAGE_KEYS.length,
			);

			for (const key of HUMAN_PAGE_KEYS) {
				const topic = getAgentTopic(locale, key);
				const document = renderCoreMarkdown(key, locale);
				expect(agentMarkdownPath(locale, key)).toBe(topic.markdownPath);
				const sectionOffsets = [
					document.indexOf(`# ${topic.title}`),
					document.indexOf(`> ${topic.summary}`),
					document.indexOf("## Scope"),
					...topic.groups.map((group) => document.indexOf(`## ${group.title}`)),
					document.indexOf("## Limitations"),
					document.indexOf("## Related"),
				];
				expect(sectionOffsets.every((offset, index) => offset >= 0 && (index === 0 || offset > sectionOffsets[index - 1]))).toBe(
					true,
				);
				for (const group of topic.groups) {
					for (const fact of group.facts) {
						expect(document).toContain(`- [${fact.id}] ${fact.value}`);
						expect(renderLlmsFull()).toContain(`- [${fact.id}] ${fact.value}`);
					}
				}
			}
		}
	});

	test("makes llms.txt a short stable Markdown directory", () => {
		const directory = renderLlmsIndex();
		expect(directory.startsWith("# ")).toBe(true);
		expect(directory).toMatch(/\n\n> [^\n]+\n/);
		expect(directory).toContain("## English");
		expect(directory).toContain("## 简体中文");
		for (const locale of ["en", "zh"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				const topic = getAgentTopic(locale, key);
				expect(directory).toContain(`- [${topic.title}](https://yonaris.com${topic.markdownPath}): ${topic.summary}`);
			}
		}
	});

	test("keeps public machine paths stable and never advertises internal rewrite routes", () => {
		const publicDirectory = renderLlmsIndex();
		for (const locale of ["en", "zh"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				const publicPath = agentMarkdownPath(locale, key);
				expect(publicDirectory).toContain(`https://yonaris.com${publicPath}`);
				expect(publicDirectory).not.toContain("/llms.mdx/");
				expect(renderCoreMarkdown(key, locale)).toContain(`Markdown document: https://yonaris.com${publicPath}`);
			}
		}
	});

	test("builds canonical, alternate, locale-peer, and directory links for public machine documents", () => {
		expect(machineLinkHelpers.agentDocumentLinks, "the topic Link-set helper must be exported").toBeTypeOf("function");
		expect(machineLinkHelpers.agentCatalogLinks, "the catalogue Link-set helper must be exported").toBeTypeOf("function");
		if (!machineLinkHelpers.agentDocumentLinks || !machineLinkHelpers.agentCatalogLinks) return;

		expect(machineLinkHelpers.agentDocumentLinks("en", "product")).toEqual([
			{ href: "/agent/product.md", rel: "canonical", type: "text/markdown" },
			{ href: "/product", rel: "alternate", type: "text/html" },
			{ href: "/agent/catalog.json", rel: "alternate", type: "application/ld+json" },
			{ href: "/zh/agent/product.md", rel: "alternate", type: "text/markdown", hrefLang: "zh-CN" },
			{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
		]);
		expect(machineLinkHelpers.agentDocumentLinks("zh", "home")).toEqual([
			{ href: "/zh/agent/index.md", rel: "canonical", type: "text/markdown" },
			{ href: "/zh", rel: "alternate", type: "text/html" },
			{ href: "/zh/agent/catalog.json", rel: "alternate", type: "application/ld+json" },
			{ href: "/agent/index.md", rel: "alternate", type: "text/markdown", hrefLang: "en" },
			{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
		]);
		expect(machineLinkHelpers.agentCatalogLinks("en")).toEqual([
			{ href: "/agent/catalog.json", rel: "canonical", type: "application/ld+json" },
			{ href: "/", rel: "alternate", type: "text/html" },
			{ href: "/zh/agent/catalog.json", rel: "alternate", type: "application/ld+json", hrefLang: "zh-CN" },
			{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
		]);
	});

	test("renders all fourteen regional Human topics from public Agent facts", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			for (const locale of ["en", "zh"] as const) {
				const facts = locale === "en" ? AGENT_FACTS.global[key] : AGENT_FACTS.zh[key];
				const document = renderCoreMarkdown(key, locale);
				expect(document).toContain(`# ${facts.title}`);
				expect(document).toContain(facts.summary);
				expect(document).toContain(locale === "en" ? "Last verified: 2026-08-25" : "最近核对：2026-08-25");
				for (const group of facts.groups) {
					expect(document).toContain(`## ${group.title}`);
					for (const fact of group.facts) expect(document).toContain(`- [${fact.id}] ${fact.value}`);
				}
			}
		}
	});

	test("publishes English and Chinese Agent topic documents and indexes", () => {
		for (const key of agentKeys) {
			expect(renderAgentDocument(key)).toBe(renderCoreMarkdown(key, "en"));
			expect(renderZhAgentDocument(key)).toBe(renderCoreMarkdown(key, "zh"));
			expect(renderAgentIndex()).toContain(`https://yonaris.com/agent/${key}`);
			expect(renderZhAgentIndex()).toContain(`https://yonaris.com/zh/agent/${key}`);
		}
		expect(renderLlmsIndex()).toContain("https://yonaris.com/llms-full.txt");
	});

	test("keeps retired topics and internal narration out of machine outputs", () => {
		const output = [renderAgentIndex(), renderZhAgentIndex(), renderLlmsIndex(), renderLlmsFull()].join("\n");
		expect(output).not.toMatch(/\/(?:zh\/)?(?:research|resources)/i);
		expect(output).not.toMatch(
			/managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|配置化观察|证据边界|当前演示/i,
		);
		expect(renderLlmsFull().match(/Last verified:/g)).toHaveLength(7);
		expect(renderLlmsFull().match(/最近核对：/g)).toHaveLength(7);
	});
});
