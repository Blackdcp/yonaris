import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/zh/results")({ head: () => marketingPageHead("zh", "results"), component: () => <MarketingDetailPage locale="zh" page="results" /> });
