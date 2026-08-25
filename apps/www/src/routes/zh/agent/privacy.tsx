import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/privacy")({
	head: () => ({ meta: [{ title: "隐私 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="privacy" />,
});
