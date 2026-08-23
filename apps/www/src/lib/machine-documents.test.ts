import { describe, expect, test } from "vitest";
import { CORE_PAGE_KEYS, getCoreFacts, getCorePageContent } from "@/content/site";
import type { AgentPageKey } from "@/content/site/types";
import { getCoreLastVerified, getCorePath, getSiteRoute } from "./site-manifest";

type MachineDocumentsModule = typeof import("./machine-documents");

async function loadSubject(): Promise<MachineDocumentsModule | undefined> {
	try {
		return (await import("./machine-documents")) as MachineDocumentsModule;
	} catch {
		return undefined;
	}
}

const subject = await loadSubject();
const agentPageKeys = ["company", "product", "approach", "research", "geo", "diagnostic"] as const;
const locales = ["en", "zh"] as const;

function requireSubject(): MachineDocumentsModule | undefined {
	expect(subject, "the shared machine-document renderer must load").toBeDefined();
	return subject;
}

function absolute(path: string): string {
	return `https://yonaris.com${path}`;
}

describe("machine documents", () => {
	test("renders every core locale from the shared facts, manifest, and verification date", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		for (const key of CORE_PAGE_KEYS) {
			for (const locale of locales) {
				const document = renderer.renderCoreMarkdown(key, locale);
				const facts = getCoreFacts(key, locale);
				const englishPath = getCorePath(key, "en");
				const chinesePath = getCorePath(key, "zh");

				expect(document).toContain(`# ${facts.title}`);
				expect(document).toContain(`Human canonical: ${absolute(getCorePath(key, locale))}`);
				expect(document).toContain(`Language: ${locale === "en" ? "English (en)" : "Simplified Chinese (zh-CN)"}`);
				expect(document).toContain(`English (en): ${absolute(englishPath)}`);
				expect(document).toContain(`Simplified Chinese (zh-CN): ${absolute(chinesePath)}`);
				expect(document).toContain(`Last verified: ${getCoreLastVerified(key)}`);
				expect(document).toContain(facts.currentScope);

				for (const claim of facts.claims) {
					expect(document).toContain(`### ${claim.id}`);
					expect(document).toContain(`- Status: ${claim.status}`);
					expect(document).toContain(`- Claim: ${claim.text}`);
					if (claim.limitation) expect(document).toContain(`- Limitation: ${claim.limitation}`);
				}
				for (const limitation of facts.limitations) expect(document).toContain(`- ${limitation}`);
			}
		}
	});

	test("publishes six scoped English Agent documents and points Home to the Agent index", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		for (const key of agentPageKeys) {
			const document = renderer.renderAgentDocument(key);
			expect(document).toBe(renderer.renderCoreMarkdown(key, "en"));
			expect(document).toContain(`Agent document: ${absolute(getSiteRoute(key).agentPath ?? "")}`);
		}

		expect(renderer.renderCoreMarkdown("home", "en")).toContain("Agent index: https://yonaris.com/agent");
	});

	test("indexes all fourteen human canonicals with language metadata and all six current Agent documents", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		for (const output of [renderer.renderAgentIndex(), renderer.renderLlmsIndex()]) {
			for (const key of CORE_PAGE_KEYS) {
				expect(output).toContain(`[${getCoreFacts(key, "en").title} (en)](${absolute(getCorePath(key, "en"))})`);
				expect(output).toContain(`[${getCoreFacts(key, "zh").title} (zh-CN)](${absolute(getCorePath(key, "zh"))})`);
			}
			for (const key of agentPageKeys) {
				expect(output).toContain(absolute(getSiteRoute(key).agentPath ?? ""));
			}
			expect(output).not.toContain("autonomous agents");
			expect(output).not.toContain("autonomous capability");
		}
	});

	test("derives index narrative from the shared Home facts instead of owning parallel product copy", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		const homeFacts = getCoreFacts("home", "en");
		const homeDescription = getCorePageContent("home", "en").meta.description;
		const direction = homeFacts.claims.find((claim) => claim.status === "direction");
		expect(direction, "Home must declare the human-and-agent direction and its limitation").toBeDefined();

		for (const output of [renderer.renderAgentIndex(), renderer.renderLlmsIndex()]) {
			expect(output).toContain(homeDescription);
			expect(output).toContain(homeFacts.currentScope);
			expect(output).toContain(direction?.text);
			expect(output).toContain(direction?.limitation);
		}
	});

	test("makes llms-full the complete fourteen-document factual set", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		const full = renderer.renderLlmsFull();
		for (const key of CORE_PAGE_KEYS) {
			for (const locale of locales) {
				const facts = getCoreFacts(key, locale);
				expect(full).toContain(`Human canonical: ${absolute(getCorePath(key, locale))}`);
				expect(full).toContain(facts.currentScope);
			}
		}
		expect(full.match(/^Human canonical:/gm)).toHaveLength(14);
	});

	test("does not serialize retired evidence or imagined product modules", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		const output = [
			renderer.renderAgentIndex(),
			renderer.renderLlmsIndex(),
			renderer.renderLlmsFull(),
			...agentPageKeys.map((key: AgentPageKey) => renderer.renderAgentDocument(key)),
		].join("\n");

		for (const forbidden of [
			"93.3%",
			"four intelligence",
			"Product Truth Graph",
			"Commercial Feedback",
			"automatic optimization",
		]) {
			expect(output).not.toContain(forbidden);
		}
	});
});
