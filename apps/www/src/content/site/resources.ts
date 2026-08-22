import type { PageMeta } from "./global";
import type { FactualClaim, Locale } from "./types";

export interface ResourceLinkContent {
	id: string;
	label: string;
	description: string;
	path: string;
}

export interface ResourcesContent {
	meta: PageMeta;
	currentScope: string;
	items: readonly ResourceLinkContent[];
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "Resources",
		description: "Research notes, documentation, terminology, service status, brand assets, and open-source context.",
	},
	currentScope:
		"The resource index separates Yonaris research and company materials from explicitly contextualized open-source infrastructure documentation.",
	items: [
		{
			id: "research",
			label: "Research notes",
			description: "Scoped measurement methods and reviewed evidence.",
			path: "/research",
		},
		{
			id: "docs",
			label: "Open-source documentation",
			description: "Technical documentation for the Elmo-compatible infrastructure foundation.",
			path: "/docs",
		},
		{
			id: "glossary",
			label: "Glossary",
			description: "Definitions for AI-mediated market measurement.",
			path: "/glossary",
		},
		{ id: "status", label: "Status", description: "Operational service information.", path: "/status" },
		{ id: "brand", label: "Brand", description: "Approved Yonaris identity assets.", path: "/brand" },
		{
			id: "open-source",
			label: "Open source",
			description: "How upstream infrastructure relates to Yonaris.",
			path: "/open-source",
		},
	],
	claims: [
		{
			id: "resources-open-source-context",
			status: "current-software",
			text: "Elmo-compatible infrastructure documentation remains available with explicit open-source context.",
			limitation: "Open-source documentation does not define the Yonaris company or its managed product promise.",
		},
	],
	limitations: [
		"Unreviewed legacy publications may remain noindex until their identity and factual claims are reviewed.",
	],
} as const satisfies ResourcesContent;

export const pageZh = {
	meta: { title: "资源", description: "研究笔记、技术文档、术语、服务状态、品牌素材与开源背景。" },
	currentScope: "资源索引会区分 Yonaris 的研究与公司材料，以及带有明确背景说明的开源基础设施文档。",
	items: [
		{ id: "research", label: "研究笔记", description: "范围明确的测量方法与经过审核的证据。", path: "/zh/research" },
		{ id: "docs", label: "开源文档", description: "Elmo 兼容基础设施的技术文档。", path: "/docs" },
		{ id: "glossary", label: "术语表", description: "AI 介入式市场测量的定义。", path: "/glossary" },
		{ id: "status", label: "服务状态", description: "服务运行信息。", path: "/status" },
		{ id: "brand", label: "品牌", description: "经批准的 Yonaris 品牌素材。", path: "/brand" },
		{ id: "open-source", label: "开源", description: "上游基础设施与 Yonaris 的关系。", path: "/open-source" },
	],
	claims: [
		{
			id: "resources-open-source-context",
			status: "current-software",
			text: "Elmo 兼容基础设施的文档会继续开放，并明确标注其开源背景。",
			limitation: "开源文档不定义 Yonaris 的公司身份或托管产品承诺。",
		},
	],
	limitations: ["尚未完成身份与事实审核的历史内容，可能继续保持不被索引。"],
} as const satisfies ResourcesContent;

export const resourcesContentByLocale: Readonly<Record<Locale, ResourcesContent>> = Object.freeze({
	en: pageEn,
	zh: pageZh,
});

export function getResourcesContent(locale: Locale): ResourcesContent {
	return resourcesContentByLocale[locale];
}
