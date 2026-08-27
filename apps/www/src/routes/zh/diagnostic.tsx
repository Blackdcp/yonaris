import { createFileRoute } from "@tanstack/react-router";
import { ChinaDiagnosticPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";
import {
	diagnosticRequestTypeFromRoute,
	validateDiagnosticRouteSearch,
} from "@/lib/diagnostic-request-intent";

function ChinaDiagnosticRoutePage() {
	const search = Route.useSearch();
	const requestType = diagnosticRequestTypeFromRoute(
		search,
		typeof window === "undefined" ? null : window.history.state,
	);
	return <ChinaDiagnosticPage requestType={requestType} />;
}

export const Route = createFileRoute("/zh/diagnostic")({
	validateSearch: validateDiagnosticRouteSearch,
	head: () => zhPageHead("diagnostic"),
	component: ChinaDiagnosticRoutePage,
});
