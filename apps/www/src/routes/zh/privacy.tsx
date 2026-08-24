import { createFileRoute } from "@tanstack/react-router";
import { ZhPrivacyPage } from "@/components/site/zh-cn/pages";
import { zhPageHead } from "@/editions/zh-cn/edition";

export const Route = createFileRoute("/zh/privacy")({
	head: () => zhPageHead("privacy"),
	component: ZhPrivacyPage,
});
