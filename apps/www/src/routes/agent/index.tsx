import { createFileRoute } from "@tanstack/react-router";
import { GlobalAgentPage } from "@/components/site/global-en/agent/global-agent-page";

export const Route = createFileRoute("/agent/")({
	head: () => ({ meta: [{ title: "Yonaris Agent view" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <GlobalAgentPage pageKey="index" />,
});
