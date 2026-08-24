import { createFileRoute } from "@tanstack/react-router";
import { ZhAgentPage } from "@/components/site/zh-cn/agent/zh-agent-page";

export const Route = createFileRoute("/zh/agent/")({
	head: () => ({ meta: [{ title: "Yonaris 中国区域 Agent 阅读" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <ZhAgentPage pageKey="index" />,
});
