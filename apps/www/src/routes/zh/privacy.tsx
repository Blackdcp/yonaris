import { createFileRoute } from "@tanstack/react-router";
import { ChinaPrivacyPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/privacy")({ head: () => zhPageHead("privacy"), component: ChinaPrivacyPage });
