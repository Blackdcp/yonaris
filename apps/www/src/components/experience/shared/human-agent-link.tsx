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
	className,
	compact = false,
}: {
	locale: "en" | "zh";
	pageKey: HumanPageKey;
	mode?: "human" | "agent";
	className?: string;
	compact?: boolean;
}) {
	const labels = compact
		? locale === "en"
			? { human: "People", agent: "Agents" }
			: { human: "人类", agent: "Agent" }
		: locale === "en"
			? { human: "For people", agent: "For agents" }
			: { human: "人类阅读", agent: "Agent 阅读" };
	return (
		<nav
			className={["mode-link", className].filter(Boolean).join(" ")}
			aria-label={locale === "en" ? "Choose reading mode" : "选择阅读方式"}
			data-mode-switch="true"
			data-compact={compact ? "true" : undefined}
		>
			<a href={humanPath(locale, pageKey)} aria-current={mode === "human" ? "page" : undefined}>
				{labels.human}
			</a>
			<a href={agentPath(locale, pageKey)} aria-current={mode === "agent" ? "page" : undefined}>
				{labels.agent}
			</a>
		</nav>
	);
}
