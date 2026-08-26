import type { HumanPageKey } from "@/content/experience/types";

function humanPath(locale: "en" | "zh", pageKey: HumanPageKey): string {
	if (locale === "en") return pageKey === "home" ? "/" : `/${pageKey}`;
	return pageKey === "home" ? "/zh" : `/zh/${pageKey}`;
}

function agentPath(locale: "en" | "zh", pageKey: HumanPageKey): string {
	if (locale === "en") return pageKey === "home" ? "/agent" : `/agent/${pageKey}`;
	return pageKey === "home" ? "/zh/agent" : `/zh/agent/${pageKey}`;
}

export function HumanAgentLink({
	locale,
	pageKey,
	mode = "human",
}: {
	locale: "en" | "zh";
	pageKey: HumanPageKey;
	mode?: "human" | "agent";
}) {
	const labels =
		locale === "en" ? { human: "For people", agent: "For AI agents" } : { human: "官网", agent: "AI Agent" };
	return (
		<nav className="mode-link" aria-label={locale === "en" ? "Choose site experience" : "选择访问方式"}>
			<a href={humanPath(locale, pageKey)} aria-current={mode === "human" ? "page" : undefined}>
				{labels.human}
			</a>
			<a href={agentPath(locale, pageKey)} aria-current={mode === "agent" ? "page" : undefined}>
				{labels.agent}
			</a>
		</nav>
	);
}
