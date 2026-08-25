import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/approach")({
	head: () => ({ meta: [{ title: "服务方案 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="approach" />,
});
