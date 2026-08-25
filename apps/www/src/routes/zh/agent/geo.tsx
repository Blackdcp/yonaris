import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/geo")({
	head: () => ({ meta: [{ title: "全球市场 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="geo" />,
});
