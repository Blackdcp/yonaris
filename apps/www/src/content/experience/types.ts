export const HUMAN_PAGE_KEYS = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as const;

export type HumanPageKey = (typeof HUMAN_PAGE_KEYS)[number];
export type ExperienceLocale = "en" | "zh";

export interface HumanPageCopy {
	readonly navLabel: string;
	readonly metaTitle: string;
	readonly metaDescription: string;
	readonly eyebrow: string;
	readonly title: string;
	readonly lead: string;
}

export interface AgentFact {
	readonly id: string;
	readonly value: string;
	readonly evidenceUrl: string;
	readonly source: string;
	readonly boundary: string;
}

export interface AgentFactGroup {
	readonly id: string;
	readonly title: string;
	readonly facts: readonly AgentFact[];
}

export interface AgentTopic {
	readonly id: string;
	readonly locale: ExperienceLocale;
	readonly language: "en" | "zh-CN";
	readonly title: string;
	readonly summary: string;
	readonly humanPath: string;
	readonly agentPath: string;
	readonly markdownPath: string;
	readonly lastReviewed: string;
	readonly reviewedBy: "Yonaris";
	readonly scope: string;
	readonly limitations: readonly string[];
	readonly groups: readonly AgentFactGroup[];
}
