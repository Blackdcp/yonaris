import { createFileRoute } from "@tanstack/react-router";
import { ZhApproachPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/approach")({
	head: () => corePageHead("approach", "zh"),
	component: ZhApproachPage,
});
