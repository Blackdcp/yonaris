import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/agent/")({
	head: () => agentPageHead("en", "home"),
	component: () => <AgentPage locale="en" pageKey="home" />,
});
