import { createFileRoute } from "@tanstack/react-router";
import { ChinaDiagnosticPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";
import { validateDiagnosticRouteSearch } from "@/lib/diagnostic-request-intent";

export const Route = createFileRoute("/zh/diagnostic")({
	validateSearch: validateDiagnosticRouteSearch,
	head: () => zhPageHead("diagnostic"),
	component: ChinaDiagnosticPage,
});
