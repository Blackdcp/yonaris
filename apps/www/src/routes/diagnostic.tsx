import { createFileRoute } from "@tanstack/react-router";
import { GlobalDiagnosticPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";
import { validateDiagnosticRouteSearch } from "@/lib/diagnostic-request-intent";

export const Route = createFileRoute("/diagnostic")({
	validateSearch: validateDiagnosticRouteSearch,
	head: () => globalEnglishPageHead("diagnostic"),
	component: GlobalDiagnosticPage,
});
