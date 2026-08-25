import type { ReactNode } from "react";

export type ZhPageKey = "home" | "product" | "approach" | "research" | "geo" | "company" | "diagnostic" | "privacy";

const primary = [
	{ key: "product" as const, label: "产品能力", href: "/zh/product" },
	{ key: "approach" as const, label: "服务方式", href: "/zh/approach" },
	{ key: "research" as const, label: "研究依据", href: "/zh/research" },
	{ key: "company" as const, label: "关于我们", href: "/zh/company" },
] as const;

const foot = [
	...primary,
	{ key: "geo" as const, label: "AI 可见度", href: "/zh/geo" },
	{ key: "diagnostic" as const, label: "需求沟通", href: "/zh/diagnostic" },
	{ key: "privacy" as const, label: "隐私说明", href: "/zh/privacy" },
] as const;

function humanHref(key: ZhPageKey): string {
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentHref(key: ZhPageKey): string {
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

export function ZhViewSwitch({ activeKey, agent = false }: { activeKey: ZhPageKey; agent?: boolean }) {
	return (
		<nav className="zh-site__view-switch" aria-label="阅读方式">
			<a href={humanHref(activeKey)} aria-current={!agent ? "page" : undefined}>
				人类阅读
			</a>
			<a href={agentHref(activeKey)} aria-current={agent ? "page" : undefined}>
				Agent 阅读
			</a>
		</nav>
	);
}

export function ZhShell({
	activeKey,
	children,
	sectionNav,
}: {
	activeKey: ZhPageKey;
	children: ReactNode;
	sectionNav?: readonly { href: string; label: string }[];
}) {
	return (
		<div className="zh-site" data-edition="zh-cn" data-visual-system="zh-decision" lang="zh-CN">
			<header className="zh-site__header">
				<div className="zh-site__header-inner">
					<a className="zh-site__logo" href="/zh" aria-label="Yonaris 中文首页">
						<img src="/brand/logos/yonaris-wordmark-navy.png" alt="Yonaris" />
					</a>
					<nav className="zh-site__primary" aria-label="主导航">
						{primary.map((item) => (
							<a key={item.key} href={item.href} aria-current={activeKey === item.key ? "page" : undefined}>
								{item.label}
							</a>
						))}
					</nav>
					<div className="zh-site__actions">
						<ZhViewSwitch activeKey={activeKey} />
						<a href="/" lang="en">
							EN
						</a>
						<a className="zh-site__button zh-site__button--compact" href="/zh/diagnostic">
							提交需求
						</a>
					</div>
					<details className="zh-site__menu">
						<summary>菜单</summary>
						<div>
							<ZhViewSwitch activeKey={activeKey} />
							{primary.map((item) => (
								<a key={item.key} href={item.href}>
									{item.label}
								</a>
							))}
							<a href="/zh/diagnostic">提交需求</a>
							<a href="/" lang="en">
								English
							</a>
						</div>
					</details>
				</div>
			</header>
			{sectionNav ? (
				<nav className="zh-site__section-nav" aria-label="首页章节">
					{sectionNav.map((item) => (
						<a key={item.href} href={item.href}>
							{item.label}
						</a>
					))}
				</nav>
			) : null}
			<main id="main-content">{children}</main>
			<footer className="zh-site__footer">
				<div>
					<a href="/zh" aria-label="Yonaris 中文首页">
						<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" />
					</a>
					<p>让 AI 时代的品牌表达，变得可见、可查、可行动。</p>
					<ZhViewSwitch activeKey={activeKey} />
				</div>
				<nav aria-label="页脚导航">
					{foot.map((item) => (
						<a key={item.key} href={item.href}>
							{item.label}
						</a>
					))}
				</nav>
				<p className="zh-site__fineprint">© 2026 Yonaris · 先看证据，再下结论。</p>
			</footer>
		</div>
	);
}
