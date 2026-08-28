import type { ReactNode } from "react";
import { EN_CATEGORY, ZH_CATEGORY } from "@/content/experience/canonical-public-facts";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { getLocaleSwitchPath } from "@/lib/locale-paths";
import { HumanAgentLink } from "./human-agent-link";

const navigation = {
	en: [
		{ key: "product", label: "Platform", href: "/product" },
		{ key: "approach", label: "Evidence", href: "/approach" },
		{ key: "company", label: "Human + Agent", href: "/company" },
		{ key: "diagnostic", label: "Contact", href: "/diagnostic" },
	],
	zh: [
		{ key: "home", label: "为什么现在", href: "/zh" },
		{ key: "product", label: "系统怎么运转", href: "/zh/product" },
		{ key: "approach", label: "看一次拆解", href: "/zh/approach" },
		{ key: "diagnostic", label: "预约沟通", href: "/zh/diagnostic" },
	],
} as const satisfies Record<"en" | "zh", readonly { key: HumanPageKey; label: string; href: string }[]>;

function PrimaryNavigation({
	locale,
	pageKey,
	mobile = false,
}: {
	locale: "en" | "zh";
	pageKey: HumanPageKey;
	mobile?: boolean;
}) {
	return (
		<nav
			className={mobile ? "site-06-mobile-nav" : "site-06-primary-nav"}
			aria-label={
				locale === "en" ? (mobile ? "Mobile navigation" : "Primary navigation") : mobile ? "移动导航" : "主导航"
			}
		>
			{navigation[locale].map((item) => (
				<a key={item.key} href={item.href} aria-current={pageKey === item.key ? "page" : undefined}>
					{item.label}
				</a>
			))}
		</nav>
	);
}

const footerLabels = {
	en: ["Home", "Platform", "Evidence", "Across markets", "Human + Agent", "Contact", "Privacy"],
	zh: ["首页", "系统怎么运转", "看一次拆解", "跨市场", "人类与 Agent", "预约沟通", "隐私说明"],
} as const satisfies Record<"en" | "zh", readonly string[]>;

function humanHref(locale: "en" | "zh", pageKey: HumanPageKey): string {
	const prefix = locale === "zh" ? "/zh" : "";
	return pageKey === "home" ? prefix || "/" : `${prefix}/${pageKey}`;
}

export function Site06Shell({
	locale,
	pageKey,
	children,
	tone = "dark",
}: {
	locale: "en" | "zh";
	pageKey: HumanPageKey;
	children: ReactNode;
	tone?: "dark" | "paper";
}) {
	const home = locale === "en" ? "/" : "/zh";
	const localeTarget = locale === "en" ? "zh" : "en";
	const localeLabel = locale === "en" ? "中文" : "English";

	return (
		<div
			className={`site-06 site-06--${tone} site-06--${pageKey}`}
			lang={locale === "en" ? "en" : "zh-CN"}
			data-generation="site-06"
			data-human-surface="true"
			data-edition={locale === "en" ? "global-en" : "zh-cn"}
		>
			<a className="site-06-skip-link" href="#site-06-main">
				{locale === "en" ? "Skip to content" : "跳至主要内容"}
			</a>
			<header className="site-06-header">
				<div className="site-06-header__inner">
					<a
						className="site-06-brand"
						href={home}
						aria-label={locale === "en" ? "Yonaris home" : "Yonaris 中文首页"}
						aria-current={pageKey === "home" ? "page" : undefined}
					>
						<img
							src={
								tone === "dark" ? "/brand/logos/yonaris-wordmark-white.png" : "/brand/logos/yonaris-wordmark-navy.png"
							}
							alt="Yonaris"
							width="340"
							height="94"
						/>
					</a>
					<PrimaryNavigation locale={locale} pageKey={pageKey} />
					<div className="site-06-header__actions">
						<HumanAgentLink locale={locale} pageKey={pageKey} className="site-06-mode" />
						<a
							className="site-06-locale"
							href={getLocaleSwitchPath(locale, pageKey, "human")}
							hrefLang={localeTarget === "zh" ? "zh-CN" : "en"}
							lang={localeTarget === "zh" ? "zh-CN" : "en"}
						>
							{localeLabel}
						</a>
					</div>
					<div className="site-06-header__mobile-mode">
						<HumanAgentLink locale={locale} pageKey={pageKey} className="site-06-mode" compact />
					</div>
					<a
						className="site-06-header__mobile-locale site-06-locale"
						href={getLocaleSwitchPath(locale, pageKey, "human")}
						hrefLang={localeTarget === "zh" ? "zh-CN" : "en"}
						lang={localeTarget === "zh" ? "zh-CN" : "en"}
					>
						{localeLabel}
					</a>
					<details className="site-06-menu">
						<summary>{locale === "en" ? "Menu" : "菜单"}</summary>
						<div className="site-06-menu__panel">
							<PrimaryNavigation locale={locale} pageKey={pageKey} mobile />
							<HumanAgentLink locale={locale} pageKey={pageKey} className="site-06-mode" />
						</div>
					</details>
				</div>
			</header>

			<main id="site-06-main" tabIndex={-1} data-page={pageKey}>
				{children}
			</main>

			<footer className="site-06-footer">
				<div className="site-06-footer__inner">
					<a
						className="site-06-footer__brand"
						href={home}
						aria-label={locale === "en" ? "Yonaris home" : "Yonaris 中文首页"}
					>
						<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" width="340" height="94" />
					</a>
					<p>{locale === "en" ? EN_CATEGORY : ZH_CATEGORY}</p>
					<nav className="site-06-footer__links" aria-label={locale === "en" ? "Footer navigation" : "页脚导航"}>
						{HUMAN_PAGE_KEYS.map((key, index) => (
							<a key={key} href={humanHref(locale, key)}>
								{footerLabels[locale][index]}
							</a>
						))}
					</nav>
					<HumanAgentLink locale={locale} pageKey={pageKey} className="site-06-mode" />
					<small>© {new Date().getFullYear()} Yonaris</small>
				</div>
			</footer>
		</div>
	);
}
