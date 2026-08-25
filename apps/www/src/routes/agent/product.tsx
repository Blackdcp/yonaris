import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/agent/product")({
	head: () => agentPageHead("en", "product"),
	component: () => <AgentPage locale="en" pageKey="product" />,
});
