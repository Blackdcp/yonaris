import type { Brand, Competitor } from "./db/schema";

function normalizeSearchText(value: string): string {
	return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function extractDomainFromUrl(urlOrDomain: string): string {
	try {
		const url = new URL(urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}`);
		return normalizeSearchText(url.hostname.replace(/^www\./, ""));
	} catch {
		return normalizeSearchText(urlOrDomain.replace(/^www\./, ""));
	}
}

function containsAny(content: string, candidates: string[]): boolean {
	return candidates.some((candidate) => candidate.length > 0 && content.includes(candidate));
}

/**
 * Apply the same deterministic brand and competitor matching to automatic and
 * imported observations. NFKC normalization keeps common full-width and
 * compatibility variants from splitting otherwise identical Chinese samples.
 */
export function analyzeMentions(
	content: string,
	brand: Pick<Brand, "name" | "aliases" | "website" | "additionalDomains">,
	competitorsList: Array<Pick<Competitor, "name" | "aliases" | "domains">>,
): {
	brandMentioned: boolean;
	competitorsMentioned: string[];
} {
	const normalizedContent = normalizeSearchText(content);
	const brandNames = [brand.name, ...(brand.aliases ?? [])].map(normalizeSearchText);
	const brandDomains = [brand.website, ...(brand.additionalDomains ?? [])].map(extractDomainFromUrl);
	const brandMentioned = containsAny(normalizedContent, brandNames) || containsAny(normalizedContent, brandDomains);

	const competitorsMentioned = competitorsList
		.filter((competitor) => {
			const names = [competitor.name, ...(competitor.aliases ?? [])].map(normalizeSearchText);
			const domains = (competitor.domains ?? []).map(extractDomainFromUrl);
			return containsAny(normalizedContent, names) || containsAny(normalizedContent, domains);
		})
		.map((competitor) => competitor.name);

	return { brandMentioned, competitorsMentioned };
}
