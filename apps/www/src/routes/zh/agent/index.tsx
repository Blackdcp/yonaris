import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/")({
	head: () => ({ meta: [{ title: "Yonaris Agent 入口" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="home" />,
});
