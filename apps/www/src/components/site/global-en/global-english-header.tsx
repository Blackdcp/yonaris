import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";

const navigation = [
	{ key: "product", label: "Product", href: "/product" },
	{ key: "approach", label: "How it works", href: "/approach" },
	{ key: "research", label: "Evidence", href: "/research" },
	{ key: "company", label: "Company", href: "/company" },
] as const;

export function GlobalEnglishHeader({ activeKey }: { activeKey?: GlobalEnglishPageKey }) {
	return (
		<header className="global-en__header">
			<a className="global-en__skip" href="#main-content">
				Skip to content
			</a>
			<div className="global-en__header-inner">
				<a className="global-en__wordmark" href="/" aria-label="Yonaris home">
					YONARIS<span aria-hidden="true">·</span>
				</a>
				<nav className="global-en__nav" aria-label="Primary navigation">
					{navigation.map((item) => (
						<a key={item.key} href={item.href} aria-current={activeKey === item.key ? "page" : undefined}>
							{item.label}
						</a>
					))}
				</nav>
				<div className="global-en__utilities">
					<a href="https://portal.yonaris.com">Customer sign in</a>
					<a href="/zh" lang="zh-CN">
						中文
					</a>
					<a className="global-en__button global-en__button--compact" href="/diagnostic">
						Request a diagnostic
					</a>
				</div>
				<details className="global-en__menu">
					<summary>Menu</summary>
					<nav aria-label="Mobile navigation">
						{navigation.map((item) => (
							<a key={item.key} href={item.href}>
								{item.label}
							</a>
						))}
						<a href="/diagnostic">Request a diagnostic</a>
						<a href="/zh" lang="zh-CN">
							中文
						</a>
					</nav>
				</details>
			</div>
		</header>
	);
}
