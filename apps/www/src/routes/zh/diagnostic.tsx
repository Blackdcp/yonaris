import { createFileRoute } from "@tanstack/react-router";
import { ZhDiagnosticPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/diagnostic")({
	head: () => corePageHead("diagnostic", "zh"),
	component: ZhDiagnosticPage,
});
