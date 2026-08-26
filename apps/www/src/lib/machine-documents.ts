import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { type AgentTopic, type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { AgentPageKey } from "@/content/site/types";
import type { MachineLinkSet } from "./machine-response";
import { siteHref } from "./site-origin";

const ORGANIZATION_DESCRIPTION =
	"AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";

export function agentMarkdownPath(locale: ExperienceLocale, key: HumanPageKey): string {
	const localePrefix = locale === "zh" ? "/zh" : "";
	return key === "home" ? `${localePrefix}/agent/index.md` : `${localePrefix}/agent/${key}.md`;
}

export function agentCatalogPath(locale: ExperienceLocale): "/agent/catalog.json" | "/zh/agent/catalog.json" {
	return locale === "en" ? "/agent/catalog.json" : "/zh/agent/catalog.json";
}

export function agentDocumentLinks(locale: ExperienceLocale, key: HumanPageKey): MachineLinkSet {
	const topic = getAgentTopic(locale, key);
	const peerLocale = locale === "en" ? "zh" : "en";
	return [
		{ href: topic.markdownPath, rel: "canonical", type: "text/markdown" },
		{ href: topic.humanPath, rel: "alternate", type: "text/html" },
		{ href: agentCatalogPath(locale), rel: "alternate", type: "application/ld+json" },
		{
			href: agentMarkdownPath(peerLocale, key),
			rel: "alternate",
			type: "text/markdown",
			hrefLang: peerLocale === "zh" ? "zh-CN" : "en",
		},
		{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
	];
}

export function agentCatalogLinks(locale: ExperienceLocale): MachineLinkSet {
	const peerLocale = locale === "en" ? "zh" : "en";
	return [
		{ href: agentCatalogPath(locale), rel: "canonical", type: "application/ld+json" },
		{ href: locale === "en" ? "/" : "/zh", rel: "alternate", type: "text/html" },
		{
			href: agentCatalogPath(peerLocale),
			rel: "alternate",
			type: "application/ld+json",
			hrefLang: peerLocale === "zh" ? "zh-CN" : "en",
		},
		{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
	];
}

export function getAgentTopic(locale: ExperienceLocale, key: HumanPageKey): AgentTopic {
	return locale === "en" ? AGENT_FACTS.global[key] : AGENT_FACTS.zh[key];
}

function renderGroups(topic: AgentTopic): string {
	return topic.groups
		.map(
			(group) => `## ${group.title}

${group.facts
	.map(
		(fact) => `### ${fact.id}

Stable ID: ${fact.id}
Fact: ${fact.value}
Evidence: ${fact.source}
Boundary: ${fact.boundary}
Human anchor: ${siteHref(fact.evidenceUrl)}`,
	)
	.join("\n\n")}`,
		)
		.join("\n\n");
}

function renderMetadata(topic: AgentTopic): string {
	const reviewLine = topic.locale === "en" ? `Last verified: ${topic.lastReviewed}` : `最近核对：${topic.lastReviewed}`;
	return [
		`Topic ID: ${topic.id}`,
		`Language: ${topic.language}`,
		`Human canonical: ${siteHref(topic.humanPath)}`,
		`Agent HTML: ${siteHref(topic.agentPath)}`,
		`Markdown document: ${siteHref(topic.markdownPath)}`,
		`JSON-LD catalogue: ${siteHref(agentCatalogPath(topic.locale))}`,
		reviewLine,
		`Reviewed by: ${topic.reviewedBy}`,
	].join("\n");
}

export function renderCoreMarkdown(key: HumanPageKey, locale: ExperienceLocale): string {
	const topic = getAgentTopic(locale, key);
	const limitations = topic.limitations.map((limitation) => `- ${limitation}`).join("\n");
	const related = [
		`- [Human canonical](${siteHref(topic.humanPath)})`,
		`- [Agent HTML](${siteHref(topic.agentPath)})`,
		`- [Markdown document](${siteHref(topic.markdownPath)})`,
		`- [JSON-LD catalogue](${siteHref(agentCatalogPath(locale))})`,
		`- [Machine directory](${siteHref("/llms.txt")})`,
	].join("\n");

	return `# ${topic.title}

> ${topic.summary}

${renderMetadata(topic)}

## Scope

${topic.scope}

${renderGroups(topic)}

## Limitations

${limitations}

## Related

${related}
`;
}

export function renderAgentDocument(key: AgentPageKey): string {
	return renderCoreMarkdown(key, "en");
}

export function renderZhAgentDocument(key: AgentPageKey): string {
	return renderCoreMarkdown(key, "zh");
}

function topicDirectory(locale: ExperienceLocale, linkTo: "agent" | "markdown"): string {
	return HUMAN_PAGE_KEYS.map((key) => {
		const topic = getAgentTopic(locale, key);
		const path = linkTo === "agent" ? topic.agentPath : topic.markdownPath;
		return `- [${topic.title}](${siteHref(path)}): ${topic.summary}`;
	}).join("\n");
}

export function renderAgentIndex(): string {
	const topic = getAgentTopic("en", "home");
	return `# ${topic.title}

> ${topic.summary}

## Topic directory

${topicDirectory("en", "agent")}

## Machine-readable endpoints

- [llms.txt](${siteHref("/llms.txt")})
- [llms-full.txt](${siteHref("/llms-full.txt")})
`;
}

export function renderZhAgentIndex(): string {
	const topic = getAgentTopic("zh", "home");
	return `# ${topic.title}

> ${topic.summary}

## 主题目录

${topicDirectory("zh", "agent")}

## 机器读取入口

- [llms.txt](${siteHref("/llms.txt")})
- [llms-full.txt](${siteHref("/llms-full.txt")})
`;
}

export function renderLlmsIndex(): string {
	return `# Yonaris machine-readable directory

> Stable public documents for Yonaris topics in English and Simplified Chinese.

## English

${topicDirectory("en", "markdown")}

## 简体中文

${topicDirectory("zh", "markdown")}

## Related

- [Complete combined reference](${siteHref("/llms-full.txt")}): All public claims in both languages.
`;
}

export function renderLlmsFull(): string {
	return `# Yonaris — public facts

${HUMAN_PAGE_KEYS.flatMap((key) => (["en", "zh"] as const).map((locale) => renderCoreMarkdown(key, locale))).join("\n\n---\n\n")}`;
}

type HrefBuilder = (path: string) => string;

function organizationNode(href: HrefBuilder) {
	return {
		"@type": "Organization",
		"@id": href("/#organization"),
		name: "Yonaris",
		url: href("/"),
		description: ORGANIZATION_DESCRIPTION,
		logo: href("/brand/logos/yonaris-wordmark-navy.png"),
	};
}

function websiteNode(href: HrefBuilder) {
	return {
		"@type": "WebSite",
		"@id": href("/#website"),
		name: "Yonaris",
		url: href("/"),
		inLanguage: ["en", "zh-CN"],
		publisher: { "@id": href("/#organization") },
	};
}

function topicNodes(topic: AgentTopic, href: HrefBuilder) {
	const humanPage = href(topic.humanPath);
	const itemListId = `${humanPage}#facts`;
	const facts = topic.groups.flatMap((group) => group.facts);
	return [
		{
			"@type": "WebPage",
			"@id": `${href(topic.humanPath)}#webpage`,
			name: topic.title,
			description: topic.summary,
			url: href(topic.humanPath),
			inLanguage: topic.language,
			isPartOf: { "@id": href("/#website") },
			about: { "@id": href("/#organization") },
			mainEntity: { "@id": itemListId },
			dateModified: topic.lastReviewed,
		},
		{
			"@type": "ItemList",
			"@id": itemListId,
			name: `${topic.title} public facts`,
			inLanguage: topic.language,
			numberOfItems: facts.length,
			itemListElement: facts.map((fact, index) => ({
				"@type": "ListItem",
				"@id": `${humanPage}#${fact.id}`,
				position: index + 1,
				identifier: fact.id,
				name: fact.value,
				description: `${fact.source} Boundary: ${fact.boundary}`,
				url: `${humanPage}#${fact.id}`,
			})),
		},
	] as const;
}

export function buildAgentEntityGraph(
	locale: ExperienceLocale,
	pageKeys: readonly HumanPageKey[],
	href: HrefBuilder = siteHref,
) {
	return [
		organizationNode(href),
		websiteNode(href),
		...pageKeys.flatMap((key) => topicNodes(getAgentTopic(locale, key), href)),
	];
}

export function renderAgentCatalog(locale: ExperienceLocale): string {
	return JSON.stringify({
		"@context": "https://schema.org",
		"@graph": buildAgentEntityGraph(locale, HUMAN_PAGE_KEYS),
	});
}
