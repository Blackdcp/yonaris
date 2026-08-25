import { describe, expect, test } from "vitest";
import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { HUMAN_PAGE_KEYS } from "@/content/experience/types";
import type { AgentPageKey } from "@/content/site/types";
import {
	renderAgentDocument,
	renderAgentIndex,
	renderCoreMarkdown,
	renderLlmsFull,
	renderLlmsIndex,
	renderZhAgentDocument,
	renderZhAgentIndex,
} from "./machine-documents";

const agentKeys = HUMAN_PAGE_KEYS.filter((key): key is AgentPageKey => key !== "home");

describe("machine documents", () => {
	test("renders all fourteen regional Human topics from public Agent facts", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			for (const locale of ["en", "zh"] as const) {
				const facts = locale === "en" ? AGENT_FACTS.global[key] : AGENT_FACTS.zh[key];
				const document = renderCoreMarkdown(key, locale);
				expect(document).toContain(`# ${facts.title}`);
				expect(document).toContain(facts.summary);
				expect(document).toContain(locale === "en" ? "Last verified: 2026-08-25" : "最近核对：2026-08-25");
				for (const group of facts.groups) {
					expect(document).toContain(`## ${group.title}`);
					for (const item of group.items) expect(document).toContain(`- ${item}`);
				}
			}
		}
	});

	test("publishes English and Chinese Agent topic documents and indexes", () => {
		for (const key of agentKeys) {
			expect(renderAgentDocument(key)).toBe(renderCoreMarkdown(key, "en"));
			expect(renderZhAgentDocument(key)).toBe(renderCoreMarkdown(key, "zh"));
			expect(renderAgentIndex()).toContain(`https://yonaris.com/agent/${key}`);
			expect(renderZhAgentIndex()).toContain(`https://yonaris.com/zh/agent/${key}`);
		}
		expect(renderLlmsIndex()).toContain("https://yonaris.com/llms-full.txt");
	});

	test("keeps retired topics and internal narration out of machine outputs", () => {
		const output = [renderAgentIndex(), renderZhAgentIndex(), renderLlmsIndex(), renderLlmsFull()].join("\n");
		expect(output).not.toMatch(/\/(?:zh\/)?(?:research|resources)/i);
		expect(output).not.toMatch(
			/managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|配置化观察|证据边界|当前演示/i,
		);
		expect(renderLlmsFull().match(/Last verified:/g)).toHaveLength(7);
		expect(renderLlmsFull().match(/最近核对：/g)).toHaveLength(7);
	});
});
