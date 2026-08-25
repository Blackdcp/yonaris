import { createFileRoute } from "@tanstack/react-router";
import { ChinaApproachPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/approach")({
	head: () => zhPageHead("approach"),
	component: ChinaApproachPage,
});
