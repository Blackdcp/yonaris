import { createFileRoute } from "@tanstack/react-router";
import { ZhGeoPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/geo")({
	head: () => zhPageHead("geo"),
	component: ZhGeoPage,
});
