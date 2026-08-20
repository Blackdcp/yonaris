import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticPage } from "@/components/marketing/diagnostic-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/zh/diagnostic")({ head: () => marketingPageHead("zh", "diagnostic"), component: () => <DiagnosticPage locale="zh" /> });
