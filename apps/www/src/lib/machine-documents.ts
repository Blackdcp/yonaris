import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { EN_CATEGORY, ZH_CATEGORY } from "@/content/experience/canonical-public-facts";
import { type AgentTopic, type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { AgentPageKey } from "@/content/site/types";
import type { MachineLinkSet } from "./machine-response";
import { siteHref } from "./site-origin";

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

const documentLabels = {
	en: {
		separator: ": ",
		topicId: "Topic ID",
		language: "Language",
		humanCanonical: "Human canonical",
		agentHtml: "Agent HTML",
		markdown: "Markdown document",
		catalogue: "JSON-LD catalogue",
		lastVerified: "Last verified",
		reviewedBy: "Reviewed by",
		scope: "Scope",
		stableId: "Stable ID",
		fact: "Fact",
		evidence: "Evidence",
		boundary: "Boundary",
		humanAnchor: "Human anchor",
		limitations: "Limitations",
		related: "Related",
		machineDirectory: "Machine directory",
	},
	zh: {
		separator: "：",
		topicId: "主题 ID",
		language: "语言",
		humanCanonical: "人类阅读对应页",
		agentHtml: "Agent HTML",
		markdown: "Markdown 文档",
		catalogue: "JSON-LD 目录",
		lastVerified: "最近核对",
		reviewedBy: "核对方",
		scope: "范围",
		stableId: "稳定 ID",
		fact: "事实",
		evidence: "证据",
		boundary: "边界",
		humanAnchor: "人类页面锚点",
		limitations: "适用边界",
		related: "相关入口",
		machineDirectory: "机器读取目录",
	},
} as const;

function renderGroups(topic: AgentTopic): string {
	const labels = documentLabels[topic.locale];
	return topic.groups
		.map(
			(group) => `## ${group.title}

${group.facts
	.map(
		(fact) => `### ${fact.id}

${labels.stableId}${labels.separator}${fact.id}
${labels.fact}${labels.separator}${fact.value}
${labels.evidence}${labels.separator}${fact.source}
${labels.boundary}${labels.separator}${fact.boundary}
${labels.humanAnchor}${labels.separator}${siteHref(fact.evidenceUrl)}`,
	)
	.join("\n\n")}`,
		)
		.join("\n\n");
}

function renderMetadata(topic: AgentTopic): string {
	const labels = documentLabels[topic.locale];
	return [
		`${labels.topicId}${labels.separator}${topic.id}`,
		`${labels.language}${labels.separator}${topic.language}`,
		`${labels.humanCanonical}${labels.separator}${siteHref(topic.humanPath)}`,
		`${labels.agentHtml}${labels.separator}${siteHref(topic.agentPath)}`,
		`${labels.markdown}${labels.separator}${siteHref(topic.markdownPath)}`,
		`${labels.catalogue}${labels.separator}${siteHref(agentCatalogPath(topic.locale))}`,
		`${labels.lastVerified}${labels.separator}${topic.lastReviewed}`,
		`${labels.reviewedBy}${labels.separator}${topic.reviewedBy}`,
	].join("\n");
}

export function renderCoreMarkdown(key: HumanPageKey, locale: ExperienceLocale): string {
	const topic = getAgentTopic(locale, key);
	const labels = documentLabels[locale];
	const limitations = topic.limitations.map((limitation) => `- ${limitation}`).join("\n");
	const related = [
		`- [${labels.humanCanonical}](${siteHref(topic.humanPath)})`,
		`- [${labels.agentHtml}](${siteHref(topic.agentPath)})`,
		`- [${labels.markdown}](${siteHref(topic.markdownPath)})`,
		`- [${labels.catalogue}](${siteHref(agentCatalogPath(locale))})`,
		`- [${labels.machineDirectory}](${siteHref("/llms.txt")})`,
	].join("\n");

	return `# ${topic.title}

> ${topic.summary}

${renderMetadata(topic)}

## ${labels.scope}

${topic.scope}

${renderGroups(topic)}

## ${labels.limitations}

${limitations}

## ${labels.related}

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

function organizationNode(locale: ExperienceLocale, href: HrefBuilder) {
	return {
		"@type": "Organization",
		"@id": href("/#organization"),
		name: "Yonaris",
		url: href("/"),
		description: locale === "en" ? EN_CATEGORY : ZH_CATEGORY,
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
	const chinese = topic.locale === "zh";
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
			name: chinese ? `${topic.title} 公开事实` : `${topic.title} public facts`,
			inLanguage: topic.language,
			numberOfItems: facts.length,
			itemListElement: facts.map((fact, index) => ({
				"@type": "ListItem",
				"@id": `${humanPage}#${fact.id}`,
				position: index + 1,
				identifier: fact.id,
				name: fact.value,
				description: chinese ? `${fact.source} 边界：${fact.boundary}` : `${fact.source} Boundary: ${fact.boundary}`,
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
		organizationNode(locale, href),
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
