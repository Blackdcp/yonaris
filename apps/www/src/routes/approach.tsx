import { createFileRoute } from "@tanstack/react-router";
import { ApproachPage } from "@/components/site/global-en/pages/approach-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/approach")({
	head: () => globalEnglishPageHead("approach"),
	component: ApproachPage,
});
