import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/agent/approach")({
	head: () => ({
		meta: [{ title: "Services | Yonaris for AI agents" }, { name: "robots", content: "noindex,follow" }],
	}),
	component: () => <AgentPage locale="en" pageKey="approach" />,
});
