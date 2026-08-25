import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { AgentPageKey, Locale } from "@/content/site/types";
import { getCoreLastVerified } from "./site-manifest";

const SITE_ORIGIN = "https://yonaris.com";
const AGENT_PAGE_KEYS = HUMAN_PAGE_KEYS.filter((key): key is AgentPageKey => key !== "home");

function absolute(path: string): string {
	return `${SITE_ORIGIN}${path}`;
}

function humanPath(key: HumanPageKey, locale: Locale): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(key: HumanPageKey, locale: Locale): string {
	if (locale === "en") return key === "home" ? "/agent" : `/agent/${key}`;
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

function factsFor(key: HumanPageKey, locale: Locale) {
	return locale === "en" ? AGENT_FACTS.global[key] : AGENT_FACTS.zh[key];
}

function renderGroups(key: HumanPageKey, locale: Locale): string {
	return factsFor(key, locale)
		.groups.map((group) => `## ${group.title}\n\n${group.items.map((item) => `- ${item}`).join("\n")}`)
		.join("\n\n");
}

export function renderCoreMarkdown(key: HumanPageKey, locale: Locale): string {
	const facts = factsFor(key, locale);
	const labels =
		locale === "en"
			? {
					human: "Human canonical",
					agent: "Agent page",
					language: "Language: English (en)",
					verified: "Last verified",
				}
			: { human: "官网对应页面", agent: "Agent 页面", language: "语言：简体中文（zh-CN）", verified: "最近核对" };
	return `# ${facts.title}

${labels.human}: ${absolute(humanPath(key, locale))}
${labels.agent}: ${absolute(agentPath(key, locale))}
${labels.language}
${labels.verified}${locale === "en" ? ": " : "："}${getCoreLastVerified(key)}

${facts.summary}

${renderGroups(key, locale)}
`;
}

export function renderAgentDocument(key: AgentPageKey): string {
	return renderCoreMarkdown(key, "en");
}

export function renderZhAgentDocument(key: AgentPageKey): string {
	return renderCoreMarkdown(key, "zh");
}

function renderTopicList(locale: Locale): string {
	return HUMAN_PAGE_KEYS.map((key) => {
		const facts = factsFor(key, locale);
		return `- [${facts.title}](${absolute(agentPath(key, locale))}) — ${facts.summary}`;
	}).join("\n");
}

export function renderAgentIndex(): string {
	const facts = AGENT_FACTS.global.home;
	return `# ${facts.title}

${facts.summary}

## Topic directory

${renderTopicList("en")}

## Machine-readable endpoints

- [llms.txt](${absolute("/llms.txt")})
- [llms-full.txt](${absolute("/llms-full.txt")})
`;
}

export function renderZhAgentIndex(): string {
	const facts = AGENT_FACTS.zh.home;
	return `# ${facts.title}

${facts.summary}

## 主题目录

${renderTopicList("zh")}

## 机器读取入口

- [llms.txt](${absolute("/llms.txt")})
- [llms-full.txt](${absolute("/llms-full.txt")})
`;
}

export function renderLlmsIndex(): string {
	return `${renderAgentIndex()}

## 简体中文 Agent 入口

- [Yonaris Agent 公开事实](${absolute("/zh/agent")})
`;
}

export function renderLlmsFull(): string {
	return `# Yonaris — public facts

${HUMAN_PAGE_KEYS.flatMap((key) => (["en", "zh"] as const).map((locale) => renderCoreMarkdown(key, locale))).join("\n\n---\n\n")}`;
}
