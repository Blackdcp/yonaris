import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "@/components/site/pages/resources-page";
import { supportingPageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/resources")({
	head: () => supportingPageHead("resources"),
	component: ResourcesPage,
});
