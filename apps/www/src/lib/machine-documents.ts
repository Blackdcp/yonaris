import { CORE_PAGE_KEYS, getCoreFacts, getCorePageContent } from "@/content/site";
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
	const title = getCorePageContent(key, locale).meta.title;
	return `[${title} (${locale === "en" ? "en" : "zh-CN"})](${absolute(getCorePath(key, locale))})`;
}

function agentReference(key: AgentPageKey): string {
	const path = getSiteRoute(key).agentPath;
	if (!path) throw new Error(`Missing Agent document path for core route: ${key}`);
	return `[${getCorePageContent(key, "en").meta.title}](${absolute(path)})`;
}

export function renderCoreMarkdown(key: CorePageKey, locale: Locale): string {
	const facts = getCoreFacts(key, locale);
	const content = getCorePageContent(key, locale);
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
English (en): ${absolute(getCorePath(key, "en"))}
Simplified Chinese (zh-CN): ${absolute(getCorePath(key, "zh"))}
${agentLine}
Last verified: ${getCoreLastVerified(key)}

## Summary

${content.meta.description}

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

function renderHumanPageLists(): string {
	return `## Human pages — English

${CORE_PAGE_KEYS.map((key) => `- ${pageReference(key, "en")}`).join("\n")}

## Human pages — Simplified Chinese

${CORE_PAGE_KEYS.map((key) => `- ${pageReference(key, "zh")}`).join("\n")}`;
}

function renderAgentPageList(): string {
	return `## Agent documents — English Markdown

${AGENT_PAGE_KEYS.map((key) => `- ${agentReference(key)}`).join("\n")}`;
}

function renderHomeIndexNarrative(): string {
	const facts = getCoreFacts("home", "en");
	const description = getCorePageContent("home", "en").meta.description;
	const directionClaims = facts.claims.filter((claim) => claim.status === "direction");
	const directions = directionClaims
		.map(
			(claim) => `- Status: ${claim.status}
- Claim: ${claim.text}${claim.limitation ? `\n- Limitation: ${claim.limitation}` : ""}`,
		)
		.join("\n");

	return `${description}

## Current scope

${facts.currentScope}

## Declared direction

${directions}`;
}

export function renderAgentIndex(): string {
	return `# Yonaris agent index

${renderHomeIndexNarrative()}

${renderHumanPageLists()}

${renderAgentPageList()}

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

## Full factual set

- [llms-full.txt](${absolute("/llms-full.txt")})
`;
}

export function renderLlmsFull(): string {
	return `# Yonaris — complete localized core facts

${CORE_PAGE_KEYS.flatMap((key) => (["en", "zh"] as const).map((locale) => renderCoreMarkdown(key, locale))).join("\n\n---\n\n")}`;
}
