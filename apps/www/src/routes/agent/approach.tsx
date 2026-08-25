import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/agent/approach")({
	head: () => agentPageHead("en", "approach"),
	component: () => <AgentPage locale="en" pageKey="approach" />,
});
