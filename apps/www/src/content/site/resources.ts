import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface ResourceLinkContent {
	id: string;
	label: string;
	description: string;
	path: string;
}

export interface ResourcesContent {
	meta: PageMeta;
	eyebrow: string;
	headline: string;
	introduction: string;
	indexLabel: string;
	currentScope: string;
	items: readonly ResourceLinkContent[];
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export interface OpenSourceRelationshipContent {
	id: "yonaris" | "upstream" | "boundary";
	label: string;
	description: string;
}

export interface CompatibilityIdentifierContent {
	id: "package" | "command" | "config" | "images" | "encryption";
	label: string;
	values: readonly string[];
}

export interface OpenSourceLinkContent {
	id: "repository" | "upstream" | "license" | "docs";
	label: string;
	href: string;
	external: boolean;
}

export interface OpenSourceContent {
	meta: PageMeta;
	eyebrow: string;
	headline: string;
	introduction: string;
	currentScope: string;
	relationship: {
		title: string;
		introduction: string;
		items: readonly OpenSourceRelationshipContent[];
	};
	compatibility: {
		title: string;
		introduction: string;
		identifiers: readonly CompatibilityIdentifierContent[];
	};
	sources: readonly OpenSourceLinkContent[];
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "Resources",
		description: "Research notes, documentation, terminology, service status, brand assets, and open-source context.",
	},
	eyebrow: "Company resources",
	headline: "A field index for reading the market.",
	introduction:
		"A compact index of Yonaris research, technical context, and company materials—each kept in its proper frame.",
	indexLabel: "Six places to go deeper",
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
	eyebrow: "公司资源",
	headline: "一份用来读懂市场的索引",
	introduction: "集中查看 Yonaris 的研究、技术背景与公司资料，并让每项内容保留清晰的语境。",
	indexLabel: "六个继续深入的入口",
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

export const resourcesContentByLocale: DeepReadonly<Record<Locale, ResourcesContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getResourcesContent(locale: Locale): DeepReadonly<ResourcesContent> {
	return resourcesContentByLocale[locale];
}

export const openSourceContent = deepFreeze({
	meta: {
		title: "Open-source infrastructure",
		description:
			"How Yonaris uses and extends Elmo-compatible infrastructure while keeping the upstream project distinct from the company and its product promise.",
	},
	eyebrow: "Open-source infrastructure",
	headline: "Infrastructure, not identity.",
	introduction:
		"Yonaris uses and extends Elmo-compatible infrastructure under the MIT License. Compatibility keeps established deployment tooling usable while Yonaris develops its own company and product experience.",
	currentScope:
		"This technical foundation does not define the Yonaris company, its customer relationship, or its product promise.",
	relationship: {
		title: "One technical lineage. Distinct identities.",
		introduction:
			"The relationship is explicit so operators can understand the stack without confusing an upstream project with the company built on it.",
		items: [
			{
				id: "yonaris",
				label: "Yonaris",
				description:
					"The company and customer-facing product: an early, service-led AI-native MarTech platform for observable market answers.",
			},
			{
				id: "upstream",
				label: "Elmo",
				description:
					"The upstream open-source project whose deployment tooling and conventions remain part of the technical foundation.",
			},
			{
				id: "boundary",
				label: "The boundary",
				description:
					"Compatibility is a technical choice. It is not a Yonaris product promise, company identity, or statement about future scope.",
			},
		],
	},
	compatibility: {
		title: "Compatibility stays visible.",
		introduction:
			"These identifiers remain in the current repository so existing upstream-compatible tooling and deployments can keep their expected names.",
		identifiers: [
			{ id: "package", label: "npm package", values: ["@elmohq/cli"] },
			{ id: "command", label: "CLI command", values: ["elmo"] },
			{ id: "config", label: "Configuration", values: ["~/.elmo", "elmo.yaml"] },
			{ id: "images", label: "Docker images", values: ["elmohq/elmo-*"] },
			{
				id: "encryption",
				label: "Encryption variables",
				values: ["ELMO_ENCRYPTION_KEY", "ELMO_ENCRYPTION_KEY_OLD"],
			},
		],
	},
	sources: [
		{
			id: "repository",
			label: "Yonaris repository",
			href: "https://github.com/Blackdcp/yonaris",
			external: true,
		},
		{
			id: "upstream",
			label: "Elmo upstream",
			href: "https://github.com/elmohq/elmo",
			external: true,
		},
		{
			id: "license",
			label: "MIT license notice",
			href: "https://github.com/Blackdcp/yonaris/blob/main/LICENSE.md",
			external: true,
		},
		{ id: "docs", label: "Open-source documentation", href: "/docs", external: false },
	],
	claims: [
		{
			id: "open-source-compatible-foundation",
			status: "current-software",
			text: "The Yonaris repository retains upstream-compatible technical identifiers and deployment conventions.",
			limitation:
				"Those identifiers describe technical compatibility; they do not define the Yonaris company or its managed product promise.",
		},
	],
	limitations: [
		"The upstream project is a separate open-source project; its documentation and release history are not Yonaris company commitments.",
		"Compatibility identifiers describe the current technical foundation, not the complete Yonaris product surface.",
	],
} as const satisfies OpenSourceContent);

export function getOpenSourceContent(): DeepReadonly<OpenSourceContent> {
	return openSourceContent;
}
