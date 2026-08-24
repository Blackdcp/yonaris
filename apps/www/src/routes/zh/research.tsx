import { createFileRoute } from "@tanstack/react-router";
import { ZhResearchPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/research")({
	head: () => zhPageHead("research"),
	component: ZhResearchPage,
});
