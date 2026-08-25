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

export interface AgentFactGroup {
	readonly title: string;
	readonly items: readonly string[];
}

export interface AgentTopic {
	readonly title: string;
	readonly summary: string;
	readonly humanPath: string;
	readonly groups: readonly AgentFactGroup[];
}

