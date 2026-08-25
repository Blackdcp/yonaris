import { createFileRoute } from "@tanstack/react-router";
import { ChinaCompanyPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/company")({ head: () => zhPageHead("company"), component: ChinaCompanyPage });
