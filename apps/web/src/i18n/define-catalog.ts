type CatalogEntries = Record<string, string>;

export function defineCatalog<
	const English extends CatalogEntries,
	const Chinese extends Record<keyof English, string>,
>(english: English, chinese: Chinese & Record<Exclude<keyof Chinese, keyof English>, never>) {
	return { english, chinese };
}
