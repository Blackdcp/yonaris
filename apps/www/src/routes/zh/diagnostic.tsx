import { createFileRoute } from "@tanstack/react-router";
import { ChinaDiagnosticPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/diagnostic")({
	head: () => zhPageHead("diagnostic"),
	component: ChinaDiagnosticPage,
});
