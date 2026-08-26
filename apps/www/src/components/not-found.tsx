import { useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

const copy = {
	en: {
		label: "404",
		title: "We can’t find that page.",
		body: "Return home to explore Yonaris.",
		home: "Back to home",
		homeAria: "Yonaris home",
		href: "/",
		documentTitle: "Page not found | Yonaris",
	},
	zh: {
		label: "404",
		title: "没有找到这个页面",
		body: "返回首页，继续了解 Yonaris。",
		home: "返回首页",
		homeAria: "Yonaris 中国站首页",
		href: "/zh",
		documentTitle: "页面不存在 | Yonaris",
	},
} as const;

export function NotFound() {
	const locale = useRouterState({
		select: (state) => (state.location.pathname === "/zh" || state.location.pathname.startsWith("/zh/") ? "zh" : "en"),
	});
	const content = copy[locale];

	return (
		<div className="zero-not-found" lang={locale === "zh" ? "zh-CN" : "en"}>
			<title>{content.documentTitle}</title>
			<meta name="robots" content="noindex,follow" />
			<a href={content.href} aria-label={content.homeAria}>
				<Logo className="zero-not-found__logo" />
			</a>
			<main>
				<span>{content.label}</span>
				<h1>{content.title}</h1>
				<p>{content.body}</p>
				<a href={content.href}>{content.home}</a>
			</main>
		</div>
	);
}
