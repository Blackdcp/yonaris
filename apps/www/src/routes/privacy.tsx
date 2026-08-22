import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/site/pages/privacy-page";
import { supportingPageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/privacy")({
	head: () => supportingPageHead("privacy"),
	component: PrivacyPage,
});
