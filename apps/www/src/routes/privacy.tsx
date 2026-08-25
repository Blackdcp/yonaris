import { createFileRoute } from "@tanstack/react-router";
import { GlobalPrivacyPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/privacy")({
	head: () => globalEnglishPageHead("privacy"),
	component: GlobalPrivacyPage,
});
