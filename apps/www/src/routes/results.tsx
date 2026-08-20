import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/results")({ head: () => marketingPageHead("en", "results"), component: () => <MarketingDetailPage locale="en" page="results" /> });
