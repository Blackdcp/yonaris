import { createFileRoute } from "@tanstack/react-router";
import { ZhProductPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/product")({
	head: () => zhPageHead("product"),
	component: ZhProductPage,
});
