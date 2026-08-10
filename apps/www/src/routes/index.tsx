import { createFileRoute } from "@tanstack/react-router";
import { Homepage } from "@/components/homepage";
import { canonicalUrl, ogMeta, SITE_NAME } from "@/lib/seo";

const HOME_TITLE = `${SITE_NAME}｜新的 MarTech 正在被重新定义`;
const HOME_DESCRIPTION =
	"AI 进入营销和购买决策之后，新的 MarTech 正在被重新定义。Yonaris 正在构建持续更新、可验证的市场理解系统。";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: HOME_TITLE },
			{ name: "description", content: HOME_DESCRIPTION },
			{ name: "theme-color", content: "#0b1220" },
			...ogMeta({
				title: HOME_TITLE,
				description: HOME_DESCRIPTION,
				path: "/",
				locale: "zh_CN",
			}),
		],
		links: [{ rel: "canonical", href: canonicalUrl("/") }],
	}),
	component: HomePage,
});

function HomePage() {
	return <Homepage />;
}
