import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/geo")({ head: () => marketingPageHead("en", "geo"), component: () => <MarketingDetailPage locale="en" page="geo" /> });
