import { createFileRoute } from "@tanstack/react-router";
import { GeoPage } from "@/components/site/pages/geo-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/geo")({
	head: () => corePageHead("geo", "zh"),
	component: () => <GeoPage locale="zh" />,
});
