import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticPage } from "@/components/marketing/diagnostic-page";
import { validateDiagnosticSearch } from "@/lib/marketing-content";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/diagnostic")({
	head: () => marketingPageHead("en", "diagnostic"),
	validateSearch: validateDiagnosticSearch,
	component: () => <DiagnosticPage locale="en" initialWebsite={Route.useSearch().website} />,
});
