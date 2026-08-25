import { createFileRoute } from "@tanstack/react-router";
import { GlobalDiagnosticPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/diagnostic")({
	head: () => globalEnglishPageHead("diagnostic"),
	component: GlobalDiagnosticPage,
});
