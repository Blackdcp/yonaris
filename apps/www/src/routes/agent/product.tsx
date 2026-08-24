import { createFileRoute } from "@tanstack/react-router";
import { GlobalAgentPage } from "@/components/site/global-en/agent/global-agent-page";

export const Route = createFileRoute("/agent/product")({
	head: () => ({ meta: [{ title: "Product facts | Yonaris Agent" }, { name: "robots", content: "noindex,follow" }] }),
	component: () => <GlobalAgentPage pageKey="product" />,
});
