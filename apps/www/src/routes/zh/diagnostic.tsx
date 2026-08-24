import { createFileRoute } from "@tanstack/react-router";
import { ZhDiagnosticPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/diagnostic")({
	head: () => zhPageHead("diagnostic"),
	component: ZhDiagnosticPage,
});
