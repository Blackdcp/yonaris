import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/site/global-en/pages/product-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/product")({
	head: () => globalEnglishPageHead("product"),
	component: ProductPage,
});
