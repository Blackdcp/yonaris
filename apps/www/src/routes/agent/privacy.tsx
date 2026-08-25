import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/agent/privacy")({
	head: () => agentPageHead("en", "privacy"),
	component: () => <AgentPage locale="en" pageKey="privacy" />,
});
