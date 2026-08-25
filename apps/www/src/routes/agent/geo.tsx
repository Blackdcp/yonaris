import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/agent/geo")({
	head: () => agentPageHead("en", "geo"),
	component: () => <AgentPage locale="en" pageKey="geo" />,
});
