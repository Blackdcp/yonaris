import { createFileRoute } from "@tanstack/react-router";
import { ZhHomePage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/")({
	head: () => corePageHead("home", "zh"),
	component: ZhHomePage,
});
