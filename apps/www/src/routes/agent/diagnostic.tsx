import { createFileRoute } from "@tanstack/react-router";
import { GlobalAgentPage } from "@/components/site/global-en/agent/global-agent-page";

export const Route = createFileRoute("/agent/diagnostic")({
	head: () => ({ meta: [{ title: "Diagnostic facts | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <GlobalAgentPage pageKey="diagnostic" />,
});
