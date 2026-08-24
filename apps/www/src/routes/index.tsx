import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/site/global-en/pages/home-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/")({
	head: () => globalEnglishPageHead("home"),
	component: HomePage,
});
