import { createFileRoute } from "@tanstack/react-router";
import { ZhCompanyPage } from "@/components/site/zh-cn/pages";
import { corePageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/zh/company")({
	head: () => corePageHead("company", "zh"),
	component: ZhCompanyPage,
});
