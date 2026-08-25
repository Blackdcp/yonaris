import type { ReactNode } from "react";
import type { HumanPageKey } from "@/content/experience/types";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";

const primaryNavigation = [
	{ key: "product" as const, label: "产品", href: "/zh/product" },
	{ key: "approach" as const, label: "服务", href: "/zh/approach" },
	{ key: "geo" as const, label: "全球市场", href: "/zh/geo" },
	{ key: "company" as const, label: "关于我们", href: "/zh/company" },
] as const;

function PrimaryNavigation({ pageKey, mobile = false }: { pageKey: HumanPageKey; mobile?: boolean }) {
	return (
		<nav
			className={mobile ? "china-mobile-nav" : "china-nav__primary"}
			aria-label={mobile ? "中国站移动导航" : "中国站主导航"}
		>
			{primaryNavigation.map((item) => (
				<a key={item.key} href={item.href} aria-current={pageKey === item.key ? "page" : undefined}>
					{item.label}
				</a>
			))}
		</nav>
	);
}

export function ChinaShell({
	pageKey,
	scene,
	children,
}: {
	pageKey: HumanPageKey;
	scene: string;
	children: ReactNode;
}) {
	const diagnosticHref = pageKey === "diagnostic" ? "#china-contact-form" : "/zh/diagnostic";
	return (
		<div
			className="china-command"
			data-generation="zero-one"
			data-human-surface="true"
			data-edition="zh-cn"
			data-scene={scene}
		>
			<a className="china-skip-link" href="#main-content">
				跳至主要内容
			</a>
			<header className="china-nav">
				<a className="china-nav__brand" href="/zh" aria-label="Yonaris 中国站首页">
					<img src="/brand/logos/yonaris-wordmark-navy.png" alt="Yonaris" width="154" height="34" />
				</a>
				<PrimaryNavigation pageKey={pageKey} />
				<div className="china-nav__actions">
					<HumanAgentLink locale="zh" pageKey={pageKey} />
					<LocaleSwitchLink locale="zh" pageKey={pageKey} />
					<a className="china-action china-action--small" href={diagnosticHref}>
						预约沟通 <span aria-hidden="true">↗</span>
					</a>
				</div>
				<details className="china-menu">
					<summary aria-label="打开主导航">
						<span>菜单</span>
						<i aria-hidden="true" />
					</summary>
					<div className="china-menu__panel">
						<PrimaryNavigation pageKey={pageKey} mobile />
						<div className="china-menu__utilities">
							<HumanAgentLink locale="zh" pageKey={pageKey} />
							<LocaleSwitchLink locale="zh" pageKey={pageKey} />
						</div>
						<a className="china-action" href={diagnosticHref}>
							预约沟通 <span aria-hidden="true">↗</span>
						</a>
					</div>
				</details>
			</header>

			<main id="main-content" tabIndex={-1}>
				{children}
			</main>

			<footer className="china-footer">
				<div className="china-footer__brand">
					<a href="/zh" aria-label="Yonaris 中国站首页">
						<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" width="166" height="37" />
					</a>
					<p>看清 AI 如何介绍、比较和理解你的品牌。</p>
				</div>
				<nav className="china-footer__links" aria-label="页脚导航">
					<div>
						<strong>了解 Yonaris</strong>
						<a href="/zh/product">产品</a>
						<a href="/zh/approach">服务</a>
						<a href="/zh/geo">全球市场</a>
					</div>
					<div>
						<strong>开始沟通</strong>
						<a href="/zh/company">关于我们</a>
						<a href={diagnosticHref}>预约沟通</a>
						<a href="/zh/privacy">隐私说明</a>
					</div>
				</nav>
				<div className="china-footer__mode">
					<HumanAgentLink locale="zh" pageKey={pageKey} />
					<LocaleSwitchLink locale="zh" pageKey={pageKey} />
					<small>© Yonaris</small>
				</div>
			</footer>
		</div>
	);
}
