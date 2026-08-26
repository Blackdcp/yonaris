import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	CATEGORY_CONFIG,
	CITATION_CATEGORIES,
	CITATION_PAGE_TYPES,
	type CitationCategory,
	type CitationPageType,
	PAGE_TYPE_CONFIG,
} from "@/lib/domain-categories";

export const CATEGORY_MESSAGE_IDS: Record<CitationCategory, MessageId> = {
	brand: "citation.category.brand",
	competitor: "citation.category.competitor",
	editorial: "citation.category.editorial",
	reviews: "citation.category.reviews",
	ecommerce: "citation.category.ecommerce",
	social: "citation.category.social",
	developer: "citation.category.developer",
	pr: "citation.category.pr",
	reference: "citation.category.reference",
	institutional: "citation.category.institutional",
	other: "citation.category.other",
};

export const PAGE_TYPE_MESSAGE_IDS: Record<CitationPageType, MessageId> = {
	homepage: "citation.page.homepage",
	article: "citation.page.article",
	listicle: "citation.page.listicle",
	howto: "citation.page.howto",
	comparison: "citation.page.comparison",
	review: "citation.page.review",
	forum: "citation.page.forum",
	video: "citation.page.video",
	doc: "citation.page.doc",
	product: "citation.page.product",
	info: "citation.page.info",
	search: "citation.page.search",
	shopping: "citation.page.shopping",
	other: "citation.page.other",
};

export const getCategoryLabel = (category: string, t?: (id: MessageId) => string) => {
	const id = CATEGORY_MESSAGE_IDS[category as CitationCategory];
	return id && t ? t(id) : (CATEGORY_CONFIG[category as CitationCategory]?.label ?? category);
};

export const getCategoryColorClass = (category: string) =>
	CATEGORY_CONFIG[category as CitationCategory]?.badgeClass ?? "bg-gray-500/90 text-white";

export const formatUrlForDisplay = (url: string) => {
	let displayUrl = url.replace(/^https?:\/\//, "");
	displayUrl = displayUrl.replace(/^www\./, "");
	displayUrl = displayUrl.replace(/#:~:text=[^&]*/, "");
	if (displayUrl.endsWith("#")) displayUrl = displayUrl.slice(0, -1);
	const maxLength = 80;
	if (displayUrl.length > maxLength) {
		displayUrl = `${displayUrl.substring(0, maxLength)}...`;
	}
	return displayUrl;
};

export const extractSubreddit = (url: string): string | null => {
	try {
		const match = url.match(/reddit\.com\/r\/([^/?#]+)/i);
		return match ? `r/${match[1]}` : null;
	} catch {
		return null;
	}
};

export const extractFilenameFromUrl = (url: string) => {
	try {
		const urlObj = new URL(url);
		const segments = urlObj.pathname.split("/").filter(Boolean);
		if (segments.length === 0) return urlObj.hostname.replace(/^www\./, "");
		return segments[segments.length - 1];
	} catch {
		return url;
	}
};

export const getCategoryMeta = (t: (id: MessageId) => string): Record<string, { label: string; color: string }> =>
	Object.fromEntries(
		CITATION_CATEGORIES.map((c) => [c, { label: t(CATEGORY_MESSAGE_IDS[c]), color: CATEGORY_CONFIG[c].chartColor }]),
	);
export const getPageTypeMeta = (t: (id: MessageId) => string): Record<string, { label: string; color: string }> =>
	Object.fromEntries(
		CITATION_PAGE_TYPES.map((p) => [p, { label: t(PAGE_TYPE_MESSAGE_IDS[p]), color: PAGE_TYPE_CONFIG[p].chartColor }]),
	);

export const attributionDotClass = (a: "brand" | "competitor" | "other") =>
	a === "brand"
		? "bg-emerald-500 yonaris-data-dot yonaris-data-1"
		: a === "competitor"
			? "bg-red-500 yonaris-data-dot yonaris-data-2"
			: "bg-gray-400 yonaris-data-dot yonaris-data-4";

export function UnderlineTabs<T extends string>({
	tabs,
	activeKey,
	onSelect,
}: {
	tabs: readonly { key: T; label: string }[];
	activeKey: T;
	onSelect: (key: T) => void;
}) {
	const { t } = useI18n();
	return (
		<nav className="-mb-px flex gap-4 overflow-x-auto border-b border-border" aria-label={t("citation.tabs")}>
			{tabs.map(({ key, label }) => (
				<button
					key={key}
					type="button"
					data-active={activeKey === key}
					onClick={() => onSelect(key)}
					className={`yonaris-inline-tab shrink-0 cursor-pointer whitespace-nowrap pb-2.5 text-xs font-medium transition-colors border-b-2 ${
						activeKey === key
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
					}`}
				>
					{label}
				</button>
			))}
		</nav>
	);
}
