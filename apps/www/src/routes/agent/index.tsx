import { createFileRoute } from "@tanstack/react-router";
import { AgentIndex } from "@/components/marketing/agent-index";
import { canonicalUrl, ogMeta } from "@/lib/seo";

const title = "Agent View | Yonaris";
const description = "Agent-readable company, platform, methodology, and results facts from Yonaris.";

export const Route = createFileRoute("/agent/")({
	head: () => ({
		meta: [{ title }, { name: "description", content: description }, { name: "theme-color", content: "#0b1220" }, ...ogMeta({ title, description, path: "/agent" })],
		links: [{ rel: "canonical", href: canonicalUrl("/agent") }],
	}),
	component: AgentIndex,
});
