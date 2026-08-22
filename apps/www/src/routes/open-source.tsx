import { createFileRoute } from "@tanstack/react-router";
import { OpenSourcePage } from "@/components/site/pages/open-source-page";
import { supportingPageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/open-source")({
	head: () => supportingPageHead("openSource"),
	component: OpenSourcePage,
});
