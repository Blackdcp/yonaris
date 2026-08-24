import { createFileRoute } from "@tanstack/react-router";
import { CompanyPage } from "@/components/site/global-en/pages/company-page";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/company")({
	head: () => globalEnglishPageHead("company"),
	component: CompanyPage,
});
