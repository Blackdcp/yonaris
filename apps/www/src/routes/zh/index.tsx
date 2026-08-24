import { createFileRoute } from "@tanstack/react-router";
import { ZhHomePage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/")({
	head: () => zhPageHead("home"),
	component: ZhHomePage,
});
