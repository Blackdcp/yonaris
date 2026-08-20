import { createFileRoute } from "@tanstack/react-router";
import { MarketingDetailPage } from "@/components/marketing/detail-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/platform")({ head: () => marketingPageHead("en", "platform"), component: () => <MarketingDetailPage locale="en" page="platform" /> });
