import { createFileRoute } from "@tanstack/react-router";
import { GeoPage } from "@/components/site/pages/geo-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/geo")({
	head: () => corePageHead("geo", "en"),
	component: () => <GeoPage locale="en" />,
});
