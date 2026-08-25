import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/diagnostic")({
	head: () => ({ meta: [{ title: "预约沟通 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="diagnostic" />,
});
