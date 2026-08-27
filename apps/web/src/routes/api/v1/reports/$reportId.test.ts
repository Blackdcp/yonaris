import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	validateApiKeyFromRequest: vi.fn(),
	isArtifactZhCnWriteEnabled: vi.fn(),
	select: vi.fn(),
	rows: [] as unknown[],
	parseGeneratedReportOutput: vi.fn(),
	computeReportUnstableStats: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/auth/policies", () => ({ validateApiKeyFromRequest: mocks.validateApiKeyFromRequest }));
vi.mock("@workspace/config/artifact-output-language", () => ({
	isArtifactZhCnWriteEnabled: mocks.isArtifactZhCnWriteEnabled,
}));
vi.mock("@workspace/lib/db/db", () => ({ db: { select: mocks.select } }));
vi.mock("@workspace/lib/db/schema", () => ({ reports: { id: "id" } }));
vi.mock("@workspace/lib/report-output", () => ({
	parseGeneratedReportOutput: mocks.parseGeneratedReportOutput,
}));
vi.mock("@workspace/lib/report-metrics", () => ({
	computeReportUnstableStats: mocks.computeReportUnstableStats,
}));
vi.mock("drizzle-orm", () => ({ eq: (left: unknown, right: unknown) => ({ left, right }) }));

import { Route } from "./$reportId";

type Handler = (input: { request: Request; params: { reportId: string } }) => Promise<Response>;
type MockRoute = { server: { handlers: { GET: Handler } } };

const reportId = "73000000-0000-4000-8000-000000000001";
const createdAt = new Date("2026-08-20T08:00:00.000Z");

function reportRow(status: "pending" | "completed", outputLanguage: "en" | "zh-CN") {
	return {
		id: reportId,
		status,
		progress: status === "completed" ? 100 : 25,
		brandName: "原始品牌 / Raw Brand",
		brandWebsite: "https://stepfun.com/原始路径",
		outputLanguage,
		createdAt,
		completedAt: status === "completed" ? createdAt : null,
		rawOutput: status === "completed" ? { stored: true } : null,
	};
}

describe("public report detail language contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rows = [];
		mocks.validateApiKeyFromRequest.mockReturnValue(true);
		mocks.select.mockImplementation(() => ({
			from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.rows) }) }),
		}));
		mocks.parseGeneratedReportOutput.mockReturnValue({
			promptRuns: [
				{
					promptValue: "原始 Prompt / Raw Prompt",
					runs: [
						{
							brandMentioned: true,
							competitorsMentioned: ["原始竞品 / Raw Rival"],
						},
					],
				},
			],
		});
		mocks.computeReportUnstableStats.mockReturnValue({ raw: "unchanged" });
	});

	it("returns outputLanguage for a pending report without applying the Chinese write gate", async () => {
		mocks.rows = [reportRow("pending", "zh-CN")];

		const response = await get();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			reportId,
			status: "pending",
			progress: 25,
			brandName: "原始品牌 / Raw Brand",
			brandWebsite: "https://stepfun.com/原始路径",
			outputLanguage: "zh-CN",
			createdAt: createdAt.toISOString(),
			completedAt: null,
		});
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
	});

	it("returns completed outputLanguage while preserving raw prompt and competitor evidence", async () => {
		mocks.rows = [reportRow("completed", "en")];

		const response = await get();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			reportId,
			status: "completed",
			outputLanguage: "en",
			prompts: [
				{
					promptValue: "原始 Prompt / Raw Prompt",
					mentions: { mentionsTopK: [{ entity: "原始竞品 / Raw Rival", count: 1 }] },
				},
			],
		});
		expect(mocks.parseGeneratedReportOutput).toHaveBeenCalledWith({ stored: true });
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
	});
});

function get(): Promise<Response> {
	const handler = (Route as unknown as MockRoute).server.handlers.GET;
	return handler({
		request: new Request(`https://portal.example.test/api/v1/reports/${reportId}`, {
			headers: { Authorization: "Bearer test-key" },
		}),
		params: { reportId },
	});
}
