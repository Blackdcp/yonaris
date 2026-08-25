import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";
import { agentPageHead } from "@/lib/seo";

export const Route = createFileRoute("/zh/agent/geo")({
	head: () => agentPageHead("zh", "geo"),
	component: () => <AgentPage locale="zh" pageKey="geo" />,
});
