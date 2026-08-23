export const DOCS_IDENTITY_DISCLOSURE =
	"These documents cover Elmo-compatible open-source infrastructure used and extended by Yonaris. They do not describe the current Yonaris managed product or its commercial promise.";

export function prependDocsIdentityDisclosure(body: string, options: { fencedLanguage?: string } = {}): string {
	const disclosure = `> ${DOCS_IDENTITY_DISCLOSURE}`;
	if (!options.fencedLanguage) return `${disclosure}\n\n${body}`;
	return `${disclosure}\n\n\`\`\`${options.fencedLanguage}\n${body}\n\`\`\``;
}
