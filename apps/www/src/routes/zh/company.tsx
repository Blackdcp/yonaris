import { createFileRoute } from "@tanstack/react-router";
import { ZhCompanyPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/company")({
	head: () => zhPageHead("company"),
	component: ZhCompanyPage,
});
