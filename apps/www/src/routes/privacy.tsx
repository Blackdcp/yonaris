import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/site/global-en/pages/privacy-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/privacy")({
	head: () => globalEnglishPageHead("privacy"),
	component: PrivacyPage,
});
