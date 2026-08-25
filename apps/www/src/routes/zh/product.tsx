import { createFileRoute } from "@tanstack/react-router";
import { ChinaProductPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/product")({ head: () => zhPageHead("product"), component: ChinaProductPage });
