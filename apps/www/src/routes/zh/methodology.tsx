import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/zh/methodology")({ head: () => marketingPageHead("zh", "methodology"), component: () => <MarketingDetailPage locale="zh" page="methodology" /> });
