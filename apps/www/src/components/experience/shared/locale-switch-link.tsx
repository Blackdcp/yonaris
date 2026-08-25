import type { HumanPageKey } from "@/content/experience/types";
import { getLocaleSwitchPath } from "@/lib/locale-paths";

export function LocaleSwitchLink({
	locale,
	pageKey,
	surface = "human",
}: {
	locale: "en" | "zh";
	pageKey: HumanPageKey;
	surface?: "human" | "agent";
}) {
	const targetLocale = locale === "en" ? "zh" : "en";
	const label = targetLocale === "zh" ? "中文" : "English";
	const accessibleLabel = locale === "en" ? "View this topic in Chinese" : "查看英文站同主题页面";

	return (
		<a
			href={getLocaleSwitchPath(locale, pageKey, surface)}
			data-locale-switch={targetLocale}
			className="locale-switch"
			hrefLang={targetLocale === "zh" ? "zh-CN" : "en"}
			lang={targetLocale === "zh" ? "zh-CN" : "en"}
			aria-label={accessibleLabel}
		>
			{label}{" "}
			<span className="locale-switch__arrow" aria-hidden="true">
				↗
			</span>
		</a>
	);
}
