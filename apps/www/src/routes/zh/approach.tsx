import { createFileRoute } from "@tanstack/react-router";
import { ZhApproachPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/approach")({
	head: () => zhPageHead("approach"),
	component: ZhApproachPage,
});
