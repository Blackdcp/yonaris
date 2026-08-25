import type { HumanPageKey } from "@/content/experience/types";
import type { Locale } from "@/content/site/types";

export function getLocaleSwitchPath(
	locale: Locale,
	activeKey: HumanPageKey = "home",
	surface: "human" | "agent" = "human",
): string {
	const targetLocale = locale === "en" ? "zh" : "en";
	if (surface === "agent") {
		if (targetLocale === "zh") return activeKey === "home" ? "/zh/agent" : `/zh/agent/${activeKey}`;
		return activeKey === "home" ? "/agent" : `/agent/${activeKey}`;
	}
	if (targetLocale === "zh") return activeKey === "home" ? "/zh" : `/zh/${activeKey}`;
	return activeKey === "home" ? "/" : `/${activeKey}`;
}
