import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticPage } from "@/components/marketing/diagnostic-page";
import { validateDiagnosticSearch } from "@/lib/marketing-content";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/zh/diagnostic")({
	head: () => marketingPageHead("zh", "diagnostic"),
	validateSearch: validateDiagnosticSearch,
	component: () => <DiagnosticPage locale="zh" initialWebsite={Route.useSearch().website} />,
});
