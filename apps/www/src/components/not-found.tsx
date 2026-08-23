import { Link, useRouterState } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";

const copy = {
	en: {
		eyebrow: "404 / UNMAPPED ROUTE",
		title: "This page is outside the current map",
		body: "The address may have moved. Continue through the current Yonaris site.",
		home: { label: "Return home", href: "/" },
		directoryLabel: "Current map",
		links: [
			{ label: "Product", href: "/product" },
			{ label: "Approach", href: "/approach" },
			{ label: "Research", href: "/research" },
			{ label: "Diagnostic", href: "/diagnostic" },
			{ label: "Company", href: "/company" },
		],
		documentTitle: "Page not found | Yonaris",
	},
	zh: {
		eyebrow: "404 / 路径未收录",
		title: "这个页面不在当前地图中",
		body: "这个地址可能已经迁移。请从当前 Yonaris 网站继续。",
		home: { label: "返回首页", href: "/zh" },
		directoryLabel: "当前目录",
		links: [
			{ label: "产品", href: "/zh/product" },
			{ label: "方法", href: "/zh/approach" },
			{ label: "研究", href: "/zh/research" },
			{ label: "免费诊断", href: "/zh/diagnostic" },
			{ label: "公司", href: "/zh/company" },
		],
		documentTitle: "页面不存在 | Yonaris",
	},
} as const;

export function NotFound() {
	const locale = useRouterState({
		select: (state) => (state.location.pathname === "/zh" || state.location.pathname.startsWith("/zh/") ? "zh" : "en"),
	});
	const content = copy[locale];

	return (
		<>
			<title>{content.documentTitle}</title>
			<meta name="robots" content="noindex,follow" />
			<SiteShell locale={locale} mainClassName="not-found-page">
				<section className="not-found-hero" aria-labelledby="not-found-title">
					<div className="not-found-frame">
						<div className="not-found-hero__marker">
							<p className="marketing-kicker">{content.eyebrow}</p>
							<span aria-hidden="true">404</span>
						</div>
						<div className="not-found-hero__statement">
							<h1 id="not-found-title" className="marketing-display">
								{content.title}
							</h1>
							<div className="not-found-hero__action">
								<p>{content.body}</p>
								<Link className="not-found-home" to={content.home.href}>
									<span>{content.home.label}</span>
									<span aria-hidden="true">↗</span>
								</Link>
							</div>
						</div>
					</div>
				</section>

				<nav className="not-found-directory" aria-label={content.directoryLabel}>
					<div className="not-found-frame not-found-directory__layout">
						<p className="marketing-kicker">{content.directoryLabel}</p>
						<ol>
							{content.links.map((item, index) => (
								<li key={item.href}>
									<Link to={item.href}>
										<span className="not-found-directory__index" aria-hidden="true">
											{String(index + 1).padStart(2, "0")}
										</span>
										<span>{item.label}</span>
										<span className="not-found-directory__arrow" aria-hidden="true">
											↗
										</span>
									</Link>
								</li>
							))}
						</ol>
					</div>
				</nav>
			</SiteShell>
		</>
	);
}
