import { createFileRoute } from "@tanstack/react-router";
import { ChinaGeoPage } from "@/components/experience/china/china-pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/geo")({ head: () => zhPageHead("geo"), component: ChinaGeoPage });
