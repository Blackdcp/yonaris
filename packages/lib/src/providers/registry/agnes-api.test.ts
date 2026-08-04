import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { API_PROVIDER_MAX_OUTPUT_TOKENS } from "../config";
import { agnesApi } from "./agnes-api";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("agnes-api", () => {
	beforeEach(() => {
		vi.stubEnv("AGNES_API_KEY", "test-agnes-key");
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("runs a model through Agnes chat completions", async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse({
				model: "agnes-2.5-flash",
				choices: [{ message: { content: "Agnes answer" }, finish_reason: "stop" }],
			}),
		);

		const result = await agnesApi.run("agnes", "hello", { version: "agnes-2.5-flash" });

		expect(result.textContent).toBe("Agnes answer");
		expect(result.modelVersion).toBe("agnes-2.5-flash");
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("https://apihub.agnes-ai.com/v1/chat/completions");
		expect(init?.headers).toMatchObject({ Authorization: "Bearer test-agnes-key" });
		expect(JSON.parse(String(init?.body))).toMatchObject({
			model: "agnes-2.5-flash",
			max_tokens: API_PROVIDER_MAX_OUTPUT_TOKENS["agnes-api"],
		});
	});

	it("returns schema-validated brand research", async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse({
				model: "agnes-2.5-flash",
				choices: [{ message: { content: '```json\n{"brandName":"Yonaris","competitors":[]}\n```' } }],
			}),
		);

		const schema = z.object({ brandName: z.string(), competitors: z.array(z.string()) });
		const result = await agnesApi.runStructuredResearch?.({ prompt: "research", schema });

		expect(result?.object).toEqual({ brandName: "Yonaris", competitors: [] });
		const [, init] = vi.mocked(fetch).mock.calls[0];
		expect(JSON.parse(String(init?.body)).response_format.type).toBe("json_schema");
	});

	it("retries without response_format when the compatibility endpoint rejects it", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(jsonResponse({ error: "unsupported response_format" }, 400))
			.mockResolvedValueOnce(
				jsonResponse({
					model: "agnes-2.5-flash",
					choices: [{ message: { content: '{"brandName":"Yonaris"}' } }],
				}),
			);

		const schema = z.object({ brandName: z.string() });
		const result = await agnesApi.runStructuredResearch?.({ prompt: "research", schema });

		expect(result?.object).toEqual({ brandName: "Yonaris" });
		expect(fetch).toHaveBeenCalledTimes(2);
		const [, retryInit] = vi.mocked(fetch).mock.calls[1];
		expect(JSON.parse(String(retryInit?.body))).not.toHaveProperty("response_format");
	});

	it("rejects targets that claim native web search", () => {
		expect(
			agnesApi.validateTarget?.({ model: "agnes", provider: "agnes-api", version: "agnes-2.5-flash", webSearch: true }),
		).toMatch(/remove the :online suffix/);
	});
});
