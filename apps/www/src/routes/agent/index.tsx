import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/agent/")({
	head: () => ({ meta: [{ title: "Yonaris for AI agents" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="en" pageKey="home" />,
});
