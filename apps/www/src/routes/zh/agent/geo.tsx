import { createFileRoute } from "@tanstack/react-router";
import { ZhAgentPage } from "@/components/site/zh-cn/agent/zh-agent-page";
export const Route = createFileRoute("/zh/agent/geo")({ head: () => ({ meta: [{ title: "AI 可见度事实 | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }), component: () => <ZhAgentPage pageKey="geo" /> });
