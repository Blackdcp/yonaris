import { createFileRoute } from "@tanstack/react-router";
import { ChinaDiagnosticPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";
import {
	useDiagnosticRequestType,
	validateDiagnosticRouteSearch,
} from "@/lib/diagnostic-request-intent";

function ChinaDiagnosticRoutePage() {
	const search = Route.useSearch();
	const requestType = useDiagnosticRequestType(search);
	return <ChinaDiagnosticPage requestType={requestType} />;
}

export const Route = createFileRoute("/zh/diagnostic")({
	validateSearch: validateDiagnosticRouteSearch,
	head: () => zhPageHead("diagnostic"),
	component: ChinaDiagnosticRoutePage,
});
