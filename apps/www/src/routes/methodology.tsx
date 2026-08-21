import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/methodology")({ head: () => marketingPageHead("en", "methodology"), component: () => <MarketingDetailPage locale="en" page="methodology" /> });
