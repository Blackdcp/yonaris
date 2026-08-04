import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ANTHROPIC_WEB_SEARCH_MAX_USES, API_PROVIDER_MAX_OUTPUT_TOKENS } from "../config";

const anthropicClient = vi.hoisted(() => ({ create: vi.fn(), constructorOptions: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: anthropicClient.create };

		constructor(options: unknown) {
			anthropicClient.constructorOptions(options);
		}
	},
}));

import { deepseekApi } from "./deepseek-api";

beforeEach(() => {
	vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
	anthropicClient.create.mockResolvedValue({
		model: "deepseek-v4-pro",
		stop_reason: "end_turn",
		content: [{ type: "text", text: "DeepSeek answer" }],
	});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe("deepseek-api", () => {
	it("uses DeepSeek's Anthropic endpoint and enables native web search", async () => {
		anthropicClient.create.mockResolvedValue({
			model: "deepseek-v4-pro",
			stop_reason: "end_turn",
			content: [
				{ type: "server_tool_use", name: "web_search", input: { query: "MemOS competitors" } },
				{
					type: "web_search_tool_result",
					content: [
						{
							type: "web_search_result",
							url: "https://example.com/source",
							title: "Source",
							encrypted_content: "large",
						},
					],
				},
				{ type: "text", text: "MemOS answer" },
			],
		});

		const result = await deepseekApi.run("deepseek", "prompt", {
			version: "deepseek-v4-pro",
			webSearch: true,
		});

		expect(anthropicClient.constructorOptions).toHaveBeenCalledWith({
			apiKey: "test-deepseek-key",
			authToken: null,
			baseURL: "https://api.deepseek.com/anthropic",
		});
		expect(anthropicClient.create).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "deepseek-v4-pro",
				max_tokens: API_PROVIDER_MAX_OUTPUT_TOKENS["deepseek-api"],
				tools: [{ type: "web_search_20250305", name: "web_search", max_uses: ANTHROPIC_WEB_SEARCH_MAX_USES }],
			}),
		);
		expect(result.webQueries).toEqual(["MemOS competitors"]);
		expect(result.citations).toEqual([
			{
				url: "https://example.com/source",
				title: "Source",
				domain: "example.com",
				citationIndex: 0,
			},
		]);
		expect(JSON.stringify(result.rawOutput)).not.toContain("large");
	});

	it("does not send the search tool for an offline target", async () => {
		await deepseekApi.run("deepseek", "prompt", { version: "deepseek-v4-pro", webSearch: false });

		expect(anthropicClient.create.mock.calls[0][0]).not.toHaveProperty("tools");
	});

	it("continues a server-search turn before returning the result", async () => {
		const searchContent = [
			{ type: "server_tool_use", name: "web_search", input: { query: "MemOS docs" } },
			{
				type: "web_search_tool_result",
				content: [
					{
						type: "web_search_result",
						url: "https://example.com/memos",
						title: "MemOS",
						encrypted_content: "keep-for-continuation",
					},
				],
			},
		];
		anthropicClient.create
			.mockResolvedValueOnce({ model: "deepseek-v4-pro", stop_reason: "tool_use", content: searchContent })
			.mockResolvedValueOnce({
				model: "deepseek-v4-pro",
				stop_reason: "end_turn",
				content: [{ type: "text", text: "Final researched answer" }],
			});

		const result = await deepseekApi.run("deepseek", "prompt", {
			version: "deepseek-v4-pro",
			webSearch: true,
		});

		expect(anthropicClient.create).toHaveBeenCalledTimes(2);
		expect(anthropicClient.create.mock.calls[1][0].messages).toEqual([
			{ role: "user", content: "prompt" },
			{ role: "assistant", content: searchContent },
		]);
		expect(result.textContent).toBe("Final researched answer");
		expect(result.webQueries).toEqual(["MemOS docs"]);
		expect(result.citations).toHaveLength(1);
		expect(JSON.stringify(result.rawOutput)).not.toContain("keep-for-continuation");
	});

	it("rejects a server-search turn that never reaches a final answer", async () => {
		const incomplete = {
			model: "deepseek-v4-pro",
			stop_reason: "tool_use",
			content: [{ type: "server_tool_use", name: "web_search", input: { query: "MemOS" } }],
		};
		anthropicClient.create.mockResolvedValue(incomplete);

		await expect(
			deepseekApi.run("deepseek", "prompt", { version: "deepseek-v4-pro", webSearch: true }),
		).rejects.toThrow("did not finish after 3 requests");
		expect(anthropicClient.create).toHaveBeenCalledTimes(3);
	});

	it("returns schema-validated structured research", async () => {
		anthropicClient.create
			.mockResolvedValueOnce({
				model: "deepseek-v4-pro",
				stop_reason: "end_turn",
				content: [{ type: "text", text: "MemTensor builds MemOS; Mem0 is a competitor." }],
			})
			.mockResolvedValueOnce({
				model: "deepseek-v4-pro",
				stop_reason: "tool_use",
				content: [{ type: "tool_use", name: "json", input: { brandName: "MemTensor", competitors: ["Mem0"] } }],
			});
		const schema = z.object({ brandName: z.string(), competitors: z.array(z.string()) });

		const result = await deepseekApi.runStructuredResearch?.({ prompt: "research", schema });

		expect(result?.object).toEqual({ brandName: "MemTensor", competitors: ["Mem0"] });
		expect(anthropicClient.create).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				tools: [expect.objectContaining({ type: "web_search_20250305", name: "web_search" })],
			}),
		);
		expect(anthropicClient.create).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				tool_choice: { type: "tool", name: "json", disable_parallel_tool_use: true },
				thinking: { type: "disabled" },
				tools: [expect.objectContaining({ name: "json" })],
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("MemTensor builds MemOS; Mem0 is a competitor."),
					}),
				],
			}),
		);
	});
});
