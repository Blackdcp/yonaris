import { createFileRoute } from "@tanstack/react-router";
import { ApproachPage } from "@/components/site/pages/approach-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/approach")({
	head: () => corePageHead("approach", "zh"),
	component: () => <ApproachPage locale="zh" />,
});
