import { createFileRoute } from "@tanstack/react-router";
import { GlobalDiagnosticPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";
import {
	useDiagnosticRequestType,
	validateDiagnosticRouteSearch,
} from "@/lib/diagnostic-request-intent";

function DiagnosticRoutePage() {
	const search = Route.useSearch();
	const requestType = useDiagnosticRequestType(search);
	return <GlobalDiagnosticPage requestType={requestType} />;
}

export const Route = createFileRoute("/diagnostic")({
	validateSearch: validateDiagnosticRouteSearch,
	head: () => globalEnglishPageHead("diagnostic"),
	component: DiagnosticRoutePage,
});
