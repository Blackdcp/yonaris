import type { InferPageType } from "fumadocs-core/source";
import { prependDocsIdentityDisclosure } from "@/lib/docs-context";
import type { source } from "@/lib/source";

export async function getLLMText(page: InferPageType<typeof source>) {
	if (page.type === "openapi") {
		return prependDocsIdentityDisclosure(JSON.stringify(page.data.getSchema(), null, 2), { fencedLanguage: "json" });
	}

	const processed = await page.data.getText("processed");

	return prependDocsIdentityDisclosure(`# ${page.data.title} (${page.url})

${processed}`);
}
