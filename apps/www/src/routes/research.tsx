import { createFileRoute } from "@tanstack/react-router";
import { ResearchPage } from "@/components/site/global-en/pages/research-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/research")({
	head: () => globalEnglishPageHead("research"),
	component: ResearchPage,
});
