import { createFileRoute } from "@tanstack/react-router";
import { CompanyPage } from "@/components/site/pages/company-page";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/company")({
	head: () => corePageHead("company", "en"),
	component: () => <CompanyPage locale="en" />,
});
