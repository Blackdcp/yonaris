import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";

const companionKeys = new Set<GlobalEnglishPageKey>([
	"product",
	"approach",
	"research",
	"geo",
	"company",
	"diagnostic",
]);

function globalHumanHref(key?: GlobalEnglishPageKey): string {
	if (!key || key === "home") return "/";
	return `/${key}`;
}

export function globalAgentHref(key?: GlobalEnglishPageKey): string {
	return key && companionKeys.has(key) ? `/agent/${key}` : "/agent";
}

export function GlobalEnglishViewSwitch({
	activeKey,
	compact = false,
}: {
	activeKey?: GlobalEnglishPageKey;
	compact?: boolean;
}) {
	return (
		<nav
			className={`global-en__view-switch${compact ? " global-en__view-switch--compact" : ""}`}
			aria-label="Reading mode"
		>
			<a href={globalHumanHref(activeKey)} aria-current="page">
				Human
			</a>
			<a href={globalAgentHref(activeKey)}>Agent</a>
		</nav>
	);
}
