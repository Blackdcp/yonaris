import { createFileRoute } from "@tanstack/react-router";
import { ZhProductPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/product")({
	head: () => corePageHead("product", "zh"),
	component: ZhProductPage,
});
