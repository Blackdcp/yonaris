import { createFileRoute } from "@tanstack/react-router";
import { GlobalProductPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/product")({
	head: () => globalEnglishPageHead("product"),
	component: GlobalProductPage,
});
