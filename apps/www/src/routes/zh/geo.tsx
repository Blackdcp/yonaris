import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/zh/geo")({ head: () => marketingPageHead("zh", "geo"), component: () => <MarketingDetailPage locale="zh" page="geo" /> });
