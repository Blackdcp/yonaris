import { createFileRoute } from "@tanstack/react-router";
import { ZhGeoPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/geo")({
	head: () => corePageHead("geo", "zh"),
	component: ZhGeoPage,
});
