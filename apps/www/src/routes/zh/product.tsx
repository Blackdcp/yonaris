import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/site/pages/product-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/product")({
	head: () => corePageHead("product", "zh"),
	component: () => <ProductPage locale="zh" />,
});
