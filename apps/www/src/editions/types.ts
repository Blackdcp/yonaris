export type SiteEdition = "global-en" | "zh-cn";
export type EditionPageRef = `${SiteEdition}:${string}`;

export interface EditionPage {
	ref: EditionPageRef;
	editionId: SiteEdition;
	locale: "en" | "zh-CN";
	pathname: `/${string}`;
	intentId: string;
	publication: "published" | "draft";
	navigation: readonly ("primary" | "footer" | "utility" | "contextual")[];
	seo: { indexable: boolean; xDefault?: boolean };
}

export interface EditionDefinition {
	id: SiteEdition;
	home: EditionPageRef;
	pages: readonly EditionPage[];
	primaryNavigation: readonly EditionPageRef[];
	footerNavigation: readonly EditionPageRef[];
	localeFallbackHome: EditionPageRef;
	analyticsPolicy: "disabled" | "global-reviewed";
	diagnosticPolicy: "disabled" | "global-v2" | "regional-v2";
}
