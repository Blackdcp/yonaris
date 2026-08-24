import { CORE_PAGE_KEYS } from "@/content/site";
import { GLOBAL_ENGLISH_MACHINE_FACTS } from "@/content/site/global-en/machine";
import { ZH_MACHINE_FACTS, type ZhMachinePageKey } from "@/content/site/zh-cn/machine";
import type { AgentPageKey, CorePageKey, Locale } from "@/content/site/types";
import { getCoreLastVerified, getCorePath, getSiteRoute } from "./site-manifest";

const SITE_ORIGIN = "https://yonaris.com";
const AGENT_PAGE_KEYS = [
	"company",
	"product",
	"approach",
	"research",
	"geo",
	"diagnostic",
] as const satisfies readonly AgentPageKey[];

function absolute(path: string): string {
	return `${SITE_ORIGIN}${path}`;
}

function languageLabel(locale: Locale): string {
	return locale === "en" ? "English (en)" : "Simplified Chinese (zh-CN)";
}

function pageReference(key: CorePageKey, locale: Locale): string {
	const title = locale === "en" ? GLOBAL_ENGLISH_MACHINE_FACTS[key].title : ZH_MACHINE_FACTS[key].title;
	return `[${title} (${locale === "en" ? "en" : "zh-CN"})](${absolute(getCorePath(key, locale))})`;
}

function agentReference(key: AgentPageKey): string {
	const path = getSiteRoute(key).agentPath;
	if (!path) throw new Error(`Missing Agent document path for core route: ${key}`);
	return `[${GLOBAL_ENGLISH_MACHINE_FACTS[key].title}](${absolute(path)})`;
}

export function renderCoreMarkdown(key: CorePageKey, locale: Locale): string {
	const facts = locale === "en" ? GLOBAL_ENGLISH_MACHINE_FACTS[key] : ZH_MACHINE_FACTS[key];
	const description =
		locale === "en" ? GLOBAL_ENGLISH_MACHINE_FACTS[key].description : ZH_MACHINE_FACTS[key].description;
	const route = getSiteRoute(key);
	const agentLine = route.agentPath
		? `Agent document: ${absolute(route.agentPath)}`
		: `Agent index: ${absolute(getSiteRoute("agent").canonicals.en ?? "/agent")}`;
	const claims = facts.claims
		.map(
			(claim) => `### ${claim.id}

- Status: ${claim.status}
- Claim: ${claim.text}${claim.limitation ? `\n- Limitation: ${claim.limitation}` : ""}`,
		)
		.join("\n\n");
	const limitations =
		facts.limitations.length > 0 ? facts.limitations.map((item) => `- ${item}`).join("\n") : "- None declared.";

	return `# ${facts.title}

Human canonical: ${absolute(getCorePath(key, locale))}
Language: ${languageLabel(locale)}
${agentLine}
Last verified: ${getCoreLastVerified(key)}

## Summary

${description}

## Current scope

${facts.currentScope}

## Claims

${claims}

## Page limitations

${limitations}
`;
}

export function renderAgentDocument(key: AgentPageKey): string {
	return renderCoreMarkdown(key, "en");
}

type ZhAgentTopic = Exclude<ZhMachinePageKey, "home">;

const ZH_AGENT_TOPICS = ["product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const satisfies readonly ZhAgentTopic[];

function zhAgentPath(key: ZhAgentTopic): string {
	return `/zh/agent/${key}`;
}

export function renderZhAgentDocument(key: ZhAgentTopic): string {
	const facts = ZH_MACHINE_FACTS[key];
	const claims = facts.claims.map((claim) => `### ${claim.id}\n\n- 状态：${claim.status}\n- 事实：${claim.text}${claim.limitation ? `\n- 边界：${claim.limitation}` : ""}`).join("\n\n");
	return `# ${facts.title}

人类页面：${absolute(`/zh/${key}`)}
语言：简体中文（zh-CN）
Agent 页面：${absolute(zhAgentPath(key))}
最后核验：2026-08-25

## 摘要

${facts.description}

## 当前范围

${facts.currentScope}

## 已声明事实

${claims}

## 页面边界

${facts.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export function renderZhAgentIndex(): string {
	const facts = ZH_MACHINE_FACTS.home;
	return `# Yonaris 中国区域 Agent 索引

${facts.description}

## 当前范围

${facts.currentScope}

## 中国区域人类与 Agent 配对页面

${ZH_AGENT_TOPICS.map((key) => `- [${ZH_MACHINE_FACTS[key].title}](${absolute(zhAgentPath(key))}) · [人类页面](${absolute(`/zh/${key}`)})`).join("\n")}

## 机器发现入口

- [llms.txt](${absolute("/llms.txt")})
- [llms-full.txt](${absolute("/llms-full.txt")})
`;
}

function renderHumanPageLists(): string {
	return `## Human pages — Global English edition

${CORE_PAGE_KEYS.map((key) => `- ${pageReference(key, "en")}`).join("\n")}

## Human pages — Chinese regional edition

${CORE_PAGE_KEYS.map((key) => `- ${pageReference(key, "zh")}`).join("\n")}`;
}

function renderAgentPageList(): string {
	return `## Agent documents — English Markdown

${AGENT_PAGE_KEYS.map((key) => `- ${agentReference(key)}`).join("\n")}`;
}

function renderZhAgentPageList(): string {
	return `## Agent 页面 — 简体中文

${ZH_AGENT_TOPICS.map((key) => `- [${ZH_MACHINE_FACTS[key].title}](${absolute(zhAgentPath(key))})`).join("\n")}`;
}

function renderHomeIndexNarrative(): string {
	const facts = GLOBAL_ENGLISH_MACHINE_FACTS.home;
	const description = facts.description;
	const declaredFacts = facts.claims
		.map(
			(claim) => `- Status: ${claim.status}
- Claim: ${claim.text}${claim.limitation ? `\n- Limitation: ${claim.limitation}` : ""}`,
		)
		.join("\n");

	return `${description}

## Current scope

${facts.currentScope}

## Declared facts

${declaredFacts}`;
}

export function renderAgentIndex(): string {
	return `# Yonaris agent index

${renderHomeIndexNarrative()}

${renderHumanPageLists()}

${renderAgentPageList()}

${renderZhAgentPageList()}

## Complete machine-readable set

- [Concise index](${absolute("/llms.txt")})
- [All fourteen localized core documents](${absolute("/llms-full.txt")})
`;
}

export function renderLlmsIndex(): string {
	return `# Yonaris

${renderHomeIndexNarrative()}

${renderHumanPageLists()}

${renderAgentPageList()}

${renderZhAgentPageList()}

## Full factual set

- [llms-full.txt](${absolute("/llms-full.txt")})
`;
}

export function renderLlmsFull(): string {
	return `# Yonaris — complete two-edition core facts

${CORE_PAGE_KEYS.flatMap((key) => (["en", "zh"] as const).map((locale) => renderCoreMarkdown(key, locale))).join("\n\n---\n\n")}`;
}
