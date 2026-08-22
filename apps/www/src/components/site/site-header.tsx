import { useEffect, useRef, useState } from "react";
import type { CorePageKey, Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { getDiagnosticNavigation, getLocaleSwitchPath, getPrimaryNavigation, PORTAL_URL } from "@/lib/site-navigation";
import { Logo } from "../logo";

interface SiteHeaderProps {
	locale: Locale;
	activeKey?: CorePageKey;
}

const copy = {
	en: {
		home: "Yonaris home",
		primary: "Primary navigation",
		mobile: "Mobile navigation",
		open: "Open menu",
		close: "Close menu",
		language: "中文",
		languageCode: "zh-CN",
	},
	zh: {
		home: "Yonaris 中文首页",
		primary: "主导航",
		mobile: "移动端导航",
		open: "打开菜单",
		close: "关闭菜单",
		language: "EN",
		languageCode: "en",
	},
} as const;

export function SiteHeader({ locale, activeKey }: SiteHeaderProps): React.ReactNode {
	const [mobileOpen, setMobileOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const text = copy[locale];
	const primary = getPrimaryNavigation(locale);
	const diagnostic = getDiagnosticNavigation(locale);
	const homePath = getCorePath("home", locale);
	const menuId = `site-mobile-navigation-${locale}`;

	useEffect(() => {
		if (!mobileOpen) return;

		function closeOnEscape(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setMobileOpen(false);
			requestAnimationFrame(() => triggerRef.current?.focus());
		}

		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [mobileOpen]);

	function closeMobileMenu(): void {
		setMobileOpen(false);
	}

	return (
		<header className="site-header sticky top-0 z-50 border-b border-[var(--yonaris-ink)]/10 bg-[var(--yonaris-paper)] text-[var(--yonaris-ink)]">
			<div className="site-header__inner mx-auto flex h-16 max-w-[90rem] items-center justify-between px-5 sm:h-[4.5rem] sm:px-8 lg:px-12">
				<a
					href={homePath}
					aria-label={text.home}
					aria-current={activeKey === "home" ? "page" : undefined}
					className="inline-flex min-h-11 items-center"
				>
					<Logo variant="navy" className="h-[1.65rem] sm:h-7" />
				</a>

				<nav aria-label={text.primary} className="site-header__primary hidden items-center gap-6 lg:flex">
					{primary.map((item) => (
						<a
							key={item.key}
							href={item.path}
							aria-current={activeKey === item.key ? "page" : undefined}
							className="inline-flex min-h-11 items-center text-xs font-medium tracking-[0.04em] text-[var(--yonaris-slate)]/74 transition-colors motion-reduce:transition-none hover:text-[var(--yonaris-ink)] focus-visible:text-[var(--yonaris-ink)] aria-[current=page]:text-[var(--yonaris-ink)] aria-[current=page]:underline aria-[current=page]:decoration-[var(--yonaris-signal)] aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
						>
							{item.label}
						</a>
					))}
				</nav>

				<div className="site-header__desktop-actions hidden items-center gap-3 lg:flex">
					<a
						href={PORTAL_URL}
						className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-[var(--yonaris-slate)]/74 hover:text-[var(--yonaris-ink)]"
					>
						Portal
					</a>
					<a
						href={getLocaleSwitchPath(locale, activeKey)}
						lang={text.languageCode}
						className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-medium text-[var(--yonaris-slate)]/74 hover:text-[var(--yonaris-ink)]"
					>
						{text.language}
					</a>
					<a
						href={diagnostic.path}
						data-site-diagnostic-action="desktop"
						className="inline-flex min-h-11 items-center justify-center rounded-[0.45rem] bg-[var(--yonaris-ink)] px-4 text-xs font-medium text-[var(--yonaris-paper)] transition-colors motion-reduce:transition-none hover:bg-[var(--yonaris-signal)] hover:text-[var(--yonaris-ink)]"
					>
						{diagnostic.label}
					</a>
				</div>

				<div className="site-header__mobile relative lg:hidden">
					<button
						ref={triggerRef}
						type="button"
						aria-label={mobileOpen ? text.close : text.open}
						aria-expanded={mobileOpen}
						aria-controls={menuId}
						onClick={() => setMobileOpen((open) => !open)}
						className="site-header__menu-trigger inline-flex min-h-11 min-w-11 items-center justify-center border border-[var(--yonaris-ink)]/18 text-[10px] font-medium tracking-[0.1em]"
					>
						{mobileOpen ? "CLOSE" : "MENU"}
					</button>
					<div
						id={menuId}
						hidden={!mobileOpen}
						className="site-header__mobile-panel absolute top-[calc(100%+0.75rem)] right-0 w-[min(21rem,calc(100vw-2.5rem))] border border-[var(--yonaris-ink)]/12 bg-[var(--yonaris-paper)] p-4 shadow-2xl shadow-black/20"
					>
						<nav aria-label={text.mobile} className="flex flex-col">
							{primary.map((item) => (
								<a
									key={item.key}
									href={item.path}
									aria-current={activeKey === item.key ? "page" : undefined}
									onClick={closeMobileMenu}
									className="flex min-h-12 items-center border-b border-[var(--yonaris-ink)]/10 text-sm text-[var(--yonaris-slate)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--yonaris-ink)]"
								>
									{item.label}
								</a>
							))}
							<a
								href={PORTAL_URL}
								onClick={closeMobileMenu}
								className="flex min-h-12 items-center border-b border-[var(--yonaris-ink)]/10 text-sm text-[var(--yonaris-slate)]"
							>
								Portal
							</a>
							<a
								href={getLocaleSwitchPath(locale, activeKey)}
								lang={text.languageCode}
								onClick={closeMobileMenu}
								className="flex min-h-12 items-center text-sm text-[var(--yonaris-slate)]"
							>
								{text.language}
							</a>
						</nav>
						<a
							href={diagnostic.path}
							data-site-diagnostic-action="mobile"
							onClick={closeMobileMenu}
							className="mt-4 inline-flex min-h-11 w-full items-center justify-center border border-[var(--yonaris-signal)] bg-[var(--yonaris-ink)] px-4 text-xs font-semibold text-[var(--yonaris-paper)] transition-colors motion-reduce:transition-none hover:bg-[var(--yonaris-signal)] hover:text-[var(--yonaris-ink)]"
						>
							{diagnostic.label}
						</a>
					</div>
				</div>
			</div>
		</header>
	);
}
