import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getBoss: vi.fn(),
	send: vi.fn(),
}));

vi.mock("@/lib/boss-client", () => ({ getBoss: mocks.getBoss }));
vi.mock("@workspace/lib/db/db", () => ({ db: { query: {} } }));
vi.mock("@workspace/lib/db/schema", () => ({ brands: {}, prompts: {} }));
vi.mock("@workspace/lib/constants", () => ({ getDefaultDelayHours: () => 24 }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { sendReportJob } from "./job-scheduler";

describe("report job scheduler language contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getBoss.mockResolvedValue({ send: mocks.send });
		mocks.send.mockResolvedValue("job-1");
	});

	it.each(["en", "zh-CN"] as const)(
		"puts the required %s artifact language in the queue payload",
		async (outputLanguage) => {
			const result = await sendReportJob({
				reportId: "73000000-0000-4000-8000-000000000001",
				brandName: "StepFun",
				brandWebsite: "https://stepfun.com/原始路径",
				outputLanguage,
				manualPrompts: ["原始 Prompt / Raw Prompt"],
			});

			expect(result).toBe(true);
			expect(mocks.send).toHaveBeenCalledWith(
				"generate-report",
				{
					reportId: "73000000-0000-4000-8000-000000000001",
					brandName: "StepFun",
					brandWebsite: "https://stepfun.com/原始路径",
					outputLanguage,
					manualPrompts: ["原始 Prompt / Raw Prompt"],
				},
				{
					retryLimit: 3,
					retryDelay: 60,
					retryBackoff: true,
					expireInSeconds: 3600,
				},
			);
		},
	);
});
