import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/site/pages/home-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/")({
	head: () => corePageHead("home", "zh"),
	component: () => <HomePage locale="zh" />,
});
