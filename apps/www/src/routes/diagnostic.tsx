import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DiagnosticPage } from "@/components/site/pages/diagnostic-page";
import { clearDiagnosticPrefillWebsite, consumeDiagnosticPrefillWebsite } from "@/lib/diagnostic-analytics-privacy";
import { parseDiagnosticSearch } from "@/lib/diagnostic-schema";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/diagnostic")({
	head: () => corePageHead("diagnostic", "en"),
	validateSearch: parseDiagnosticSearch,
	search: { middlewares: [stripSearchParams({ website: "" })] },
	component: EnglishDiagnosticRoute,
});

function EnglishDiagnosticRoute() {
	const search = Route.useSearch();
	const [initialWebsite] = useState(() => consumeDiagnosticPrefillWebsite(search.website));

	useEffect(() => {
		clearDiagnosticPrefillWebsite();
	}, []);

	return <DiagnosticPage locale="en" initialWebsite={initialWebsite} />;
}
