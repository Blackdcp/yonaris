import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticPage } from "@/components/marketing/diagnostic-page";
import { marketingPageHead } from "@/lib/marketing-seo";

export const Route = createFileRoute("/diagnostic")({ head: () => marketingPageHead("en", "diagnostic"), component: () => <DiagnosticPage locale="en" /> });
