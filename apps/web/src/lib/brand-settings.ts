import { validateWebsiteUrl } from "@/lib/brand-website";
import { cleanAndValidateDomain } from "@/lib/domain-categories";

export const MAX_BRAND_NAME_LENGTH = 200;
export const MAX_WEBSITE_INPUT_LENGTH = 2_048;
export const MAX_BRAND_DOMAINS = 50;
export const MAX_COMPETITOR_DOMAINS = 20;
export const MAX_RESOURCE_ALIASES = 50;
export const MAX_ALIAS_LENGTH = 200;
export const MAX_DOMAIN_INPUT_LENGTH = 253;
export const MAX_COMPETITOR_NAME_LENGTH = 200;

/** Stable machine-readable failures shared by customer-brand creation server and client code. */
export const BRAND_CREATION_ERROR_CODES = {
	forbidden: "BRAND_CREATION_FORBIDDEN",
	notAllowed: "BRAND_CREATION_NOT_ALLOWED",
} as const;

/**
 * Pure normalization/validation for the "edit brand settings" flow, extracted
 * from the updateBrand server function so the rules can be unit-tested without a
 * database or auth session (issue #107). The server function applies auth and
 * persistence; this owns the field-level rules:
 *
 *  - name: trimmed; must be non-empty when provided
 *  - website: validated + normalized to an origin URL
 *  - additionalDomains: each cleaned/validated (hard error listing the invalid
 *    ones), then de-duplicated
 *  - aliases: trimmed, empties dropped, de-duplicated
 *
 * Only keys present on the input are touched, so a partial edit leaves the rest
 * of the brand untouched.
 */
export interface BrandUpdateInput {
	name?: string;
	website?: string;
	additionalDomains?: string[];
	aliases?: string[];
}

export interface BrandUpdateFields {
	name?: string;
	website?: string;
	additionalDomains?: string[];
	aliases?: string[];
}

export type NormalizeBrandUpdateResult = { ok: true; updates: BrandUpdateFields } | { ok: false; error: string };

export function normalizeBrandUpdate(input: BrandUpdateInput): NormalizeBrandUpdateResult {
	const updates: BrandUpdateFields = {};

	if (input.name !== undefined) {
		if (!input.name.trim()) {
			return { ok: false, error: "Brand name must be a non-empty string" };
		}
		updates.name = input.name.trim();
	}

	if (input.website !== undefined) {
		const urlValidation = validateWebsiteUrl(input.website);
		if (!urlValidation.isValid) {
			return { ok: false, error: urlValidation.error };
		}
		updates.website = urlValidation.formattedUrl;
	}

	if (input.additionalDomains !== undefined) {
		const cleaned = input.additionalDomains.map((d) => cleanAndValidateDomain(d));
		const invalid = input.additionalDomains.filter((_, i) => !cleaned[i]);
		if (invalid.length > 0) {
			return { ok: false, error: `Invalid domain(s): ${invalid.join(", ")}` };
		}
		updates.additionalDomains = [...new Set(cleaned.filter(Boolean) as string[])];
	}

	if (input.aliases !== undefined) {
		updates.aliases = [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))];
	}

	return { ok: true, updates };
}
