import { createFileRoute } from "@tanstack/react-router";
import { ChinaHomePage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/")({ head: () => zhPageHead("home"), component: ChinaHomePage });
