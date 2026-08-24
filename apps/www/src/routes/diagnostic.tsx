import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticPage } from "@/components/site/global-en/pages/diagnostic-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/diagnostic")({
	head: () => globalEnglishPageHead("diagnostic"),
	component: DiagnosticPage,
});
