import { describe, expect, test } from "vitest";

const DISCLOSURE =
	"These documents cover Elmo-compatible open-source infrastructure used and extended by Yonaris. They do not describe the current Yonaris managed product or its commercial promise.";

interface DocsContextModule {
	DOCS_IDENTITY_DISCLOSURE: string;
	prependDocsIdentityDisclosure: (body: string, options?: { fencedLanguage?: string }) => string;
}

async function loadSubject(): Promise<DocsContextModule | undefined> {
	try {
		const modulePath = "./docs-context";
		return (await import(modulePath)) as DocsContextModule;
	} catch {
		return undefined;
	}
}

describe("open-source documentation identity context", () => {
	test("publishes one exact disclosure for HTML, Markdown, and OG consumers", async () => {
		const subject = await loadSubject();
		expect(subject, "docs-context must be implemented").toBeDefined();
		if (!subject) return;

		expect(subject.DOCS_IDENTITY_DISCLOSURE).toBe(DISCLOSURE);
		expect(subject.prependDocsIdentityDisclosure("# Introduction")).toBe(`> ${DISCLOSURE}\n\n# Introduction`);
	});

	test("keeps OpenAPI machine output Markdown while preserving the schema verbatim", async () => {
		const subject = await loadSubject();
		expect(subject, "docs-context must be implemented").toBeDefined();
		if (!subject) return;

		const schema = '{\n  "openapi": "3.1.0"\n}';
		const output = subject.prependDocsIdentityDisclosure(schema, { fencedLanguage: "json" });
		expect(output).toContain(`> ${DISCLOSURE}`);
		expect(output).toContain(`\n\n\`\`\`json\n${schema}\n\`\`\``);
	});
});
