import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/site/pages/product-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/product")({
	head: () => corePageHead("product", "en"),
	component: () => <ProductPage locale="en" />,
});
