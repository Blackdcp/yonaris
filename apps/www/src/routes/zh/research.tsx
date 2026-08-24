import { createFileRoute } from "@tanstack/react-router";
import { ZhResearchPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/research")({
	head: () => corePageHead("research", "zh"),
	component: ZhResearchPage,
});
