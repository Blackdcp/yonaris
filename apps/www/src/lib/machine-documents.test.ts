import { describe, expect, test } from "vitest";
import { CORE_PAGE_KEYS } from "@/content/site";
import { GLOBAL_ENGLISH_MACHINE_FACTS } from "@/content/site/global-en/machine";
import { ZH_MACHINE_FACTS } from "@/content/site/zh-cn/machine";
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
	test("renders independent global-English and Chinese regional facts", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		for (const key of CORE_PAGE_KEYS) {
			for (const locale of locales) {
				const document = renderer.renderCoreMarkdown(key, locale);
				const facts = locale === "en" ? GLOBAL_ENGLISH_MACHINE_FACTS[key] : ZH_MACHINE_FACTS[key];

				expect(document).toContain(`# ${facts.title}`);
				expect(document).toContain(`Human canonical: ${absolute(getCorePath(key, locale))}`);
				expect(document).toContain(`Language: ${locale === "en" ? "English (en)" : "Simplified Chinese (zh-CN)"}`);
				expect(document).not.toContain("English (en):");
				expect(document).not.toContain("Simplified Chinese (zh-CN):");
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

	test("indexes both independent editions and all six current Agent documents", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		for (const output of [renderer.renderAgentIndex(), renderer.renderLlmsIndex()]) {
			for (const key of CORE_PAGE_KEYS) {
				expect(output).toContain(
					`[${GLOBAL_ENGLISH_MACHINE_FACTS[key].title} (en)](${absolute(getCorePath(key, "en"))})`,
				);
				expect(output).toContain(`[${ZH_MACHINE_FACTS[key].title} (zh-CN)](${absolute(getCorePath(key, "zh"))})`);
			}
			for (const key of agentPageKeys) {
				expect(output).toContain(absolute(getSiteRoute(key).agentPath ?? ""));
			}
			expect(output).not.toContain("autonomous agents");
			expect(output).not.toContain("autonomous capability");
		}
	});

	test("derives the machine index narrative from the global-English edition", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		const homeFacts = GLOBAL_ENGLISH_MACHINE_FACTS.home;
		const homeDescription = homeFacts.description;
		const firstClaim = homeFacts.claims[0];
		expect(firstClaim, "Global Home must declare at least one current fact").toBeDefined();

		for (const output of [renderer.renderAgentIndex(), renderer.renderLlmsIndex()]) {
			expect(output).toContain(homeDescription);
			expect(output).toContain(homeFacts.currentScope);
			expect(output).toContain(firstClaim?.text);
		}
	});

	test("makes llms-full the complete two-edition factual set", () => {
		const renderer = requireSubject();
		if (!renderer) return;

		const full = renderer.renderLlmsFull();
		for (const key of CORE_PAGE_KEYS) {
			for (const locale of locales) {
				const facts = locale === "en" ? GLOBAL_ENGLISH_MACHINE_FACTS[key] : ZH_MACHINE_FACTS[key];
				expect(full).toContain(`Human canonical: ${absolute(getCorePath(key, locale))}`);
				expect(full).toContain(facts.currentScope);
			}
		}
		expect(full.match(/^Human canonical:/gm)).toHaveLength(14);
		expect(full).not.toContain("complete localized core facts");
	});

	test("publishes Chinese Agent documents from the released regional facts", () => {
		const renderer = requireSubject();
		if (!renderer) return;
		const index = renderer.renderZhAgentIndex();
		for (const key of ["product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const) {
			const document = renderer.renderZhAgentDocument(key);
			expect(document).toContain(`# ${ZH_MACHINE_FACTS[key].title}`);
			expect(document).toContain(`人类页面：https://yonaris.com/zh/${key}`);
			expect(document).toContain(ZH_MACHINE_FACTS[key].currentScope);
			expect(index).toContain(`https://yonaris.com/zh/agent/${key}`);
		}
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
			"Product Evidence Graph",
			"Market Learning",
			"automatic optimization",
		]) {
			expect(output).not.toContain(forbidden);
		}
	});
});
