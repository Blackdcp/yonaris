import { getGlobalContent } from "@/content/site/global";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { getFooterNavigation } from "@/lib/site-navigation";
import { Logo } from "../logo";

export function SiteFooter({ locale }: { locale: Locale }): React.ReactNode {
	const groups = getFooterNavigation(locale);
	const content = getGlobalContent(locale);

	return (
		<footer className="site-footer border-t border-white/10 bg-[var(--yonaris-ink)] text-[var(--yonaris-paper)]">
			<div className="site-footer__inner mx-auto grid max-w-[90rem] gap-12 px-5 py-14 sm:px-8 md:grid-cols-12 lg:px-12 lg:py-20">
				<div className="md:col-span-5">
					<a
						href={getCorePath("home", locale)}
						aria-label={locale === "zh" ? "Yonaris 中文首页" : "Yonaris home"}
						className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--yonaris-signal)]"
					>
						<Logo variant="white" className="h-7" />
					</a>
					<p className="mt-6 max-w-sm text-sm leading-6 text-[var(--yonaris-paper)]/62">{content.currentScope}</p>
				</div>
				<nav
					aria-label={locale === "zh" ? "页脚导航" : "Footer navigation"}
					className="grid gap-8 sm:grid-cols-3 md:col-span-7"
				>
					{groups.map((group) => (
						<div key={group.label}>
							<p className="marketing-kicker text-[var(--yonaris-paper)]/48">{group.label}</p>
							<ul className="mt-5 space-y-2">
								{group.items.map((item) => (
									<li key={item.key}>
										<a
											href={item.path}
											className="inline-flex min-h-8 items-center text-sm text-[var(--yonaris-paper)]/72 hover:text-[var(--yonaris-paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yonaris-signal)]"
										>
											{item.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>
			</div>
			<div className="site-footer__legal border-t border-white/10">
				<div className="mx-auto flex min-h-16 max-w-[90rem] flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs uppercase tracking-[0.12em] text-[var(--yonaris-paper)]/48 sm:px-8 lg:px-12">
					<span>© {new Date().getFullYear()} Yonaris</span>
					<span>MarTech, rebuilt. For humans and agents.</span>
				</div>
			</div>
		</footer>
	);
}
