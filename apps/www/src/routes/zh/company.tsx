import { createFileRoute } from "@tanstack/react-router";
import { CompanyPage } from "@/components/site/pages/company-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/company")({
	head: () => corePageHead("company", "zh"),
	component: () => <CompanyPage locale="zh" />,
});
