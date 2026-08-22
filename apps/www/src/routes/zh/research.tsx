import { createFileRoute } from "@tanstack/react-router";
import { ResearchPage } from "@/components/site/pages/research-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/research")({
	head: () => corePageHead("research", "zh"),
	component: () => <ResearchPage locale="zh" />,
});
