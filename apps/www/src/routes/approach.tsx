import { createFileRoute } from "@tanstack/react-router";
import { GlobalApproachPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/approach")({
	head: () => globalEnglishPageHead("approach"),
	component: GlobalApproachPage,
});
