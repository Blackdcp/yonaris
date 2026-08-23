import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const olostepClient = vi.hoisted(() => ({
	create: vi.fn(),
	retrieve: vi.fn(),
}));

vi.mock("olostep", () => ({
	default: class {
		batches = { create: olostepClient.create };
		retrieve = olostepClient.retrieve;
	},
}));

import { olostep } from "./olostep";

function completedBatch() {
	return {
		waitTillDone: vi.fn().mockResolvedValue(undefined),
		items: async function* () {
			yield { retrieve_id: "retrieve-1" };
		},
	};
}

beforeEach(() => {
	vi.stubEnv("OLOSTEP_API_KEY", "test-key");
	olostepClient.create.mockResolvedValue(completedBatch());
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe("olostep provider", () => {
	it("reports observed search when the response exposes search queries", async () => {
		olostepClient.retrieve.mockResolvedValueOnce({
			json_content: {
				answer: "Answer",
				search_queries: ["expanded query"],
			},
		});

		const result = await olostep.run("chatgpt", "Question", { webSearch: true });

		expect(result.webQueries).toEqual(["expanded query"]);
		expect(result.webSearchObserved).toBe(true);
	});

	it("keeps observed search unknown when the response exposes no evidence", async () => {
		olostepClient.retrieve.mockResolvedValueOnce({ json_content: { answer: "Answer" } });

		const result = await olostep.run("chatgpt", "Question", { webSearch: true });

		expect(result.webSearchObserved).toBeNull();
	});
});
