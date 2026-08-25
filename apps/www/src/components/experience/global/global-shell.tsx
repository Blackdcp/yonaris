import type { ReactNode } from "react";
import type { HumanPageKey } from "@/content/experience/types";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";
import { ScrollProgress } from "../shared/scroll-progress";

const NAV_ITEMS: readonly { key: HumanPageKey; label: string; href: string }[] = [
	{ key: "product", label: "Product", href: "/product" },
	{ key: "approach", label: "Approach", href: "/approach" },
	{ key: "geo", label: "Global markets", href: "/geo" },
	{ key: "company", label: "Company", href: "/company" },
];

function PrimaryNavigation({ pageKey, mobile = false }: { pageKey: HumanPageKey; mobile?: boolean }) {
	return (
		<nav
			className={mobile ? "sf-mobile-nav" : "sf-primary-nav"}
			aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
		>
			{NAV_ITEMS.map((item) => (
				<a key={item.key} href={item.href} aria-current={pageKey === item.key ? "page" : undefined}>
					{item.label}
				</a>
			))}
		</nav>
	);
}

export function GlobalShell({
	pageKey,
	scene,
	children,
}: {
	pageKey: HumanPageKey;
	scene: string;
	children: ReactNode;
}) {
	return (
		<div
			className={`sf-shell sf-shell--${pageKey}`}
			lang="en"
			data-generation="zero-one"
			data-human-surface="true"
			data-edition="global-en"
		>
			<ScrollProgress />
			<a className="sf-skip-link" href="#main-content">
				Skip to content
			</a>
			<header className="sf-header">
				<div className="sf-header__inner">
					<a
						className="sf-brand"
						href="/"
						aria-label="Yonaris home"
						aria-current={pageKey === "home" ? "page" : undefined}
					>
						<img src="/brand/logos/yonaris-wordmark-navy.png" alt="Yonaris" width="340" height="94" />
					</a>
					<PrimaryNavigation pageKey={pageKey} />
					<div className="sf-header__actions">
						<HumanAgentLink locale="en" pageKey={pageKey} />
						<LocaleSwitchLink locale="en" pageKey={pageKey} />
						<a className="sf-button sf-button--small" href="/diagnostic">
							Talk to Yonaris <span aria-hidden="true">↗</span>
						</a>
					</div>
					<details className="sf-menu">
						<summary aria-label="Open navigation">
							<span />
							<span />
						</summary>
						<div className="sf-menu__panel">
							<PrimaryNavigation pageKey={pageKey} mobile />
							<div className="sf-menu__utilities">
								<HumanAgentLink locale="en" pageKey={pageKey} />
								<LocaleSwitchLink locale="en" pageKey={pageKey} />
							</div>
							<a className="sf-button" href="/diagnostic">
								Talk to Yonaris <span aria-hidden="true">↗</span>
							</a>
						</div>
					</details>
				</div>
			</header>

			<main id="main-content" tabIndex={-1} data-page={pageKey} data-scene={scene}>
				{children}
			</main>

			<footer className="sf-footer">
				<div className="sf-footer__brand">
					<a className="sf-footer__home-link" href="/" aria-label="Yonaris home">
						<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" width="340" height="94" />
					</a>
					<p>Review how your brand appears in selected AI answers.</p>
				</div>
				<div className="sf-footer__links">
					<div>
						<span>Explore</span>
						{NAV_ITEMS.map((item) => (
							<a key={item.key} href={item.href}>
								{item.label}
							</a>
						))}
					</div>
					<div>
						<span>Connect</span>
						<a href="/diagnostic">Talk to Yonaris</a>
						<a href="/privacy">Privacy</a>
						<LocaleSwitchLink locale="en" pageKey={pageKey} />
					</div>
				</div>
				<div className="sf-footer__bottom">
					<HumanAgentLink locale="en" pageKey={pageKey} />
					<small>© {new Date().getFullYear()} Yonaris</small>
				</div>
			</footer>
			<a className="sf-mobile-cta" href="/diagnostic">
				Talk to Yonaris <span aria-hidden="true">↗</span>
			</a>
		</div>
	);
}
