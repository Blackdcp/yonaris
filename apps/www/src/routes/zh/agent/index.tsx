import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/zh/agent/")({
	head: () => agentPageHead("zh", "home"),
	component: () => <AgentPage locale="zh" pageKey="home" />,
});
