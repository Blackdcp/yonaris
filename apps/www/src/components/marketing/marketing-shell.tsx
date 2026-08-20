import type { ReactNode } from "react";
import { getMarketingContent, getMarketingNavigation, type Locale, type MarketingPageKey, CONTACT_EMAIL } from "@/lib/marketing-content";
import { Logo } from "../logo";
import { MarketingLink } from "./marketing-link";

interface MarketingShellProps {
	locale: Locale;
	page?: MarketingPageKey;
	children: ReactNode;
}

export function MarketingShell({ locale, page = "home", children }: MarketingShellProps) {
	const content = getMarketingContent(locale);
	const navigation = getMarketingNavigation(locale, page);

	return (
		<div className="marketing-site min-h-[100svh] bg-[var(--yonaris-paper)] text-[var(--yonaris-ink)]" lang={locale === "zh" ? "zh-CN" : "en"}>
			<header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--yonaris-ink)]/95 text-[var(--yonaris-paper)] backdrop-blur-sm">
				<div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
					<a href={navigation.home} aria-label={locale === "zh" ? "Yonaris 中文首页" : "Yonaris home"} className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yonaris-signal)]">
						<Logo variant="white" className="h-[1.65rem] sm:h-7" />
					</a>

					<nav aria-label={locale === "zh" ? "主导航" : "Primary navigation"} className="hidden items-center gap-6 lg:flex">
						{navigation.items.map((item) => (
							<a key={item.path} href={item.path} className="inline-flex min-h-11 items-center text-[11px] font-medium tracking-[0.04em] text-[var(--yonaris-paper)]/68 transition-colors hover:text-[var(--yonaris-paper)] focus-visible:outline-none focus-visible:text-[var(--yonaris-signal)]">
								{item.label}
							</a>
						))}
					</nav>

					<div className="hidden items-center gap-3 lg:flex">
						<a href={navigation.language.path} lang={locale === "zh" ? "en" : "zh-CN"} className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[11px] font-medium text-[var(--yonaris-paper)]/68 hover:text-[var(--yonaris-paper)] focus-visible:outline-none focus-visible:text-[var(--yonaris-signal)]">
							{navigation.language.label}
						</a>
						<MarketingLink href={navigation.diagnostic.path} className="min-h-10 px-3.5" showArrow={false}>{navigation.diagnostic.label}</MarketingLink>
					</div>

					<details className="marketing-mobile-menu relative lg:hidden">
						<summary className="inline-flex min-h-11 min-w-11 list-none items-center justify-center border border-white/18 text-[10px] font-medium tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yonaris-signal)]">MENU</summary>
						<div className="absolute top-[calc(100%+0.75rem)] right-0 w-[min(21rem,calc(100vw-2.5rem))] border border-white/12 bg-[var(--yonaris-ink)] p-4 shadow-2xl shadow-black/30">
							<nav aria-label={locale === "zh" ? "移动端导航" : "Mobile navigation"} className="flex flex-col">
								{navigation.items.map((item) => (
									<a key={item.path} href={item.path} className="flex min-h-12 items-center border-b border-white/10 text-sm text-[var(--yonaris-paper)]/78">{item.label}</a>
								))}
								<a href={navigation.language.path} lang={locale === "zh" ? "en" : "zh-CN"} className="flex min-h-12 items-center text-sm text-[var(--yonaris-paper)]/78">{navigation.language.label}</a>
							</nav>
							<MarketingLink href={navigation.diagnostic.path} className="mt-4 w-full" showArrow={false}>{navigation.diagnostic.label}</MarketingLink>
						</div>
					</details>
				</div>
			</header>

			<main>{children}</main>

			<footer className="border-t border-white/10 bg-[var(--yonaris-ink)] text-[var(--yonaris-paper)]">
				<div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-14 sm:px-8 md:grid-cols-12 lg:px-12 lg:py-20">
					<div className="md:col-span-5">
						<Logo variant="white" className="h-7" />
						<p className="mt-6 max-w-sm text-sm leading-6 text-[var(--yonaris-paper)]/58">{content.companyDefinition}</p>
					</div>
					<div className="grid gap-8 sm:grid-cols-2 md:col-span-6 md:col-start-7">
						<div>
							<p className="marketing-kicker text-[var(--yonaris-paper)]/42">{locale === "zh" ? "浏览" : "Explore"}</p>
							<div className="mt-5 flex flex-col items-start gap-2">
								{navigation.items.slice(0, 4).map((item) => <a key={item.path} href={item.path} className="min-h-8 text-sm text-[var(--yonaris-paper)]/68 hover:text-[var(--yonaris-paper)]">{item.label}</a>)}
							</div>
						</div>
						<div>
							<p className="marketing-kicker text-[var(--yonaris-paper)]/42">{locale === "zh" ? "联系" : "Contact"}</p>
							<a href={`mailto:${CONTACT_EMAIL}`} className="mt-5 inline-flex min-h-8 items-center text-sm text-[var(--yonaris-paper)]/68 hover:text-[var(--yonaris-paper)]">{CONTACT_EMAIL}</a>
							<div className="mt-4"><MarketingLink href={navigation.diagnostic.path} variant="text">{content.cta.primary}</MarketingLink></div>
						</div>
					</div>
				</div>
				<div className="border-t border-white/10">
					<div className="mx-auto flex min-h-16 max-w-[90rem] flex-wrap items-center justify-between gap-4 px-5 py-4 text-[10px] uppercase tracking-[0.12em] text-[var(--yonaris-paper)]/48 sm:px-8 lg:px-12">
						<span>© {new Date().getFullYear()} Yonaris</span>
						<span>Finite truths. Recursive growth.</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
