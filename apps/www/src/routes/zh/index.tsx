import { createFileRoute } from "@tanstack/react-router";
import { MarketingHomePage } from "@/components/marketing/home-page";
import { getMarketingPageMeta } from "@/lib/marketing-content";
import { canonicalUrl, ogMeta, organizationJsonLd } from "@/lib/seo";

const page = getMarketingPageMeta("zh", "home");

export const Route = createFileRoute("/zh/")({
	head: () => ({
		meta: [
			{ title: page.title },
			{ name: "description", content: page.description },
			{ name: "theme-color", content: "#0b1220" },
			...ogMeta({ title: page.title, description: page.description, path: "/zh", locale: "zh_CN" }),
		],
		links: [
			{ rel: "canonical", href: canonicalUrl("/zh") },
			{ rel: "alternate", hrefLang: "en", href: canonicalUrl("/") },
			{ rel: "alternate", hrefLang: "zh-CN", href: canonicalUrl("/zh") },
			{ rel: "alternate", hrefLang: "x-default", href: canonicalUrl("/") },
		],
		scripts: [organizationJsonLd()],
	}),
	component: () => <MarketingHomePage locale="zh" />,
});
