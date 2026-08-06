const VALID_BRAND_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Resolve a legacy brand id to its canonical id using a comma-separated
 * `legacy:canonical` mapping. Invalid entries are ignored so one typo cannot
 * take the dashboard offline.
 */
export function resolveBrandIdAlias(brandId: string, rawAliases: string | undefined): string {
	if (!rawAliases) return brandId;

	const aliases = new Map<string, string>();
	for (const rawEntry of rawAliases.split(",")) {
		const entry = rawEntry.trim();
		const separator = entry.indexOf(":");
		if (separator <= 0 || separator === entry.length - 1) continue;

		const legacyId = entry.slice(0, separator).trim();
		const canonicalId = entry.slice(separator + 1).trim();
		if (!VALID_BRAND_ID.test(legacyId) || !VALID_BRAND_ID.test(canonicalId) || legacyId === canonicalId) {
			continue;
		}
		aliases.set(legacyId, canonicalId);
	}

	let resolved = brandId;
	const visited = new Set<string>();
	while (aliases.has(resolved) && !visited.has(resolved)) {
		visited.add(resolved);
		resolved = aliases.get(resolved) as string;
	}

	// A cycle is a configuration error. Returning the original id is the safest
	// behavior because it preserves the pre-alias access path.
	return visited.has(resolved) ? brandId : resolved;
}
