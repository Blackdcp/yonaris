import { createFileRoute } from "@tanstack/react-router";
import { ZhPrivacyPage } from "@/components/site/zh-cn/pages";

export const Route = createFileRoute("/zh/privacy")({
	head: () => ({
		meta: [
			{ title: "隐私说明 | Yonaris" },
			{ name: "description", content: "Yonaris 中国区域需求表单的信息处理说明。" },
		],
	}),
	component: ZhPrivacyPage,
});
