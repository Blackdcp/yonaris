import { createFileRoute } from "@tanstack/react-router";
import { AgentPage } from "@/components/experience/agent/agent-pages";

export const Route = createFileRoute("/zh/agent/product")({
	head: () => ({ meta: [{ title: "产品 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <AgentPage locale="zh" pageKey="product" />,
});
