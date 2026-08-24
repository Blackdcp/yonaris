import { createFileRoute } from "@tanstack/react-router";
import { GeoPage } from "@/components/site/global-en/pages/geo-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/geo")({
	head: () => globalEnglishPageHead("geo"),
	component: GeoPage,
});
