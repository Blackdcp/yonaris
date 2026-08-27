import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	validateApiKeyFromRequest: vi.fn(),
	getDeployment: vi.fn(),
	isArtifactZhCnWriteEnabled: vi.fn(),
	validatePublicHttpUrl: vi.fn(),
	select: vi.fn(),
	selectResults: [] as unknown[][],
	selectProjections: [] as unknown[],
	insert: vi.fn(),
	insertResults: [] as unknown[][],
	insertValues: [] as unknown[],
	update: vi.fn(),
	updateSets: [] as unknown[],
	sendReportJob: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/auth/policies", () => ({ validateApiKeyFromRequest: mocks.validateApiKeyFromRequest }));
vi.mock("@/lib/config/server", () => ({ getDeployment: mocks.getDeployment }));
vi.mock("@/lib/job-scheduler", () => ({ sendReportJob: mocks.sendReportJob }));
vi.mock("@workspace/config/artifact-output-language", () => ({
	isArtifactZhCnWriteEnabled: mocks.isArtifactZhCnWriteEnabled,
}));
vi.mock("@workspace/lib/public-http-url", () => ({ validatePublicHttpUrl: mocks.validatePublicHttpUrl }));
vi.mock("@workspace/lib/db/db", () => ({
	db: { select: mocks.select, insert: mocks.insert, update: mocks.update },
}));
vi.mock("@workspace/lib/db/schema", () => ({
	reports: {
		id: "id",
		brandName: "brandName",
		brandWebsite: "brandWebsite",
		status: "status",
		outputLanguage: "outputLanguage",
		createdAt: "createdAt",
		completedAt: "completedAt",
	},
}));
vi.mock("drizzle-orm", () => ({
	count: () => "count",
	desc: (value: unknown) => ({ desc: value }),
	eq: (left: unknown, right: unknown) => ({ left, right }),
}));

import { REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE, Route } from "./index";

type Handler = (input: { request: Request; params: Record<string, string> }) => Promise<Response>;
type MockRoute = { server: { handlers: { POST: Handler; GET: Handler } } };

const reportId = "73000000-0000-4000-8000-000000000001";
const createdAt = new Date("2026-08-20T08:00:00.000Z");

function reportRow(outputLanguage: "en" | "zh-CN") {
	return {
		id: reportId,
		brandName: "StepFun",
		brandWebsite: "https://stepfun.com/原始路径",
		status: "pending",
		outputLanguage,
		createdAt,
		completedAt: null,
	};
}

function reportBody(outputLanguage?: unknown) {
	return {
		brandName: " StepFun ",
		brandWebsite: "stepfun.com/原始路径",
		manualPrompts: ["原始 Prompt / Raw Prompt"],
		...(outputLanguage === undefined ? {} : { outputLanguage }),
	};
}

describe("public report collection language contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectResults.length = 0;
		mocks.selectProjections.length = 0;
		mocks.insertResults.length = 0;
		mocks.insertValues.length = 0;
		mocks.updateSets.length = 0;
		mocks.validateApiKeyFromRequest.mockReturnValue(true);
		mocks.getDeployment.mockReturnValue({ features: { reportGeneration: true } });
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(false);
		mocks.validatePublicHttpUrl.mockResolvedValue({ href: "https://stepfun.com/原始路径" });
		mocks.sendReportJob.mockResolvedValue(true);

		mocks.select.mockImplementation((projection?: unknown) => {
			mocks.selectProjections.push(projection);
			const rows = mocks.selectResults.shift() ?? [];
			if (typeof projection === "object" && projection !== null && "count" in projection) {
				return { from: () => Promise.resolve(rows) };
			}
			const chain = {
				from: () => chain,
				orderBy: () => chain,
				limit: () => chain,
				offset: () => Promise.resolve(rows),
			};
			return chain;
		});
		mocks.insert.mockImplementation(() => ({
			values: (value: unknown) => {
				mocks.insertValues.push(value);
				return { returning: () => Promise.resolve(mocks.insertResults.shift() ?? []) };
			},
		}));
		mocks.update.mockImplementation(() => ({
			set: (value: unknown) => {
				mocks.updateSets.push(value);
				return { where: () => Promise.resolve() };
			},
		}));
	});

	it("defaults the request to English but queues and returns the strictly parsed persisted language", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);

		const response = await post(reportBody());

		expect(response.status).toBe(201);
		expect(mocks.isArtifactZhCnWriteEnabled).toHaveBeenCalledOnce();
		expect(mocks.insertValues).toEqual([
			{
				brandName: "StepFun",
				brandWebsite: "https://stepfun.com/原始路径",
				status: "pending",
				outputLanguage: "en",
			},
		]);
		expect(mocks.sendReportJob).toHaveBeenCalledWith({
			reportId,
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com/原始路径",
			outputLanguage: "zh-CN",
			manualPrompts: ["原始 Prompt / Raw Prompt"],
		});
		expect(await response.json()).toEqual({
			reportId,
			status: "pending",
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com/原始路径",
			outputLanguage: "zh-CN",
			createdAt: createdAt.toISOString(),
		});
	});

	it("fails closed and marks the row failed when persisted Chinese is not enabled", async () => {
		mocks.insertResults.push([reportRow("zh-CN")]);

		const response = await post(reportBody());
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({ code: "report-output-language-temporarily-unavailable" });
		expect(mocks.updateSets).toEqual([{ status: "failed", updatedAt: expect.any(Date) }]);
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("rejects an invalid persisted language before queueing", async () => {
		mocks.insertResults.push([{ ...reportRow("en"), outputLanguage: "zh-SG" }]);

		const response = await post(reportBody());

		expect(response.status).toBe(500);
		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "en" });
		expect(mocks.updateSets).toEqual([{ status: "failed", updatedAt: expect.any(Date) }]);
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("persists and queues explicit Simplified Chinese when enabled", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);

		const response = await post(reportBody("zh-CN"));

		expect(response.status).toBe(201);
		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "zh-CN" });
		expect(mocks.sendReportJob).toHaveBeenCalledWith({
			reportId,
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com/原始路径",
			outputLanguage: "zh-CN",
			manualPrompts: ["原始 Prompt / Raw Prompt"],
		});
		expect(await response.json()).toMatchObject({ outputLanguage: "zh-CN" });
	});

	it.each(["zh", "CN", "zh-SG"])("rejects invalid outputLanguage=%s before route side effects", async (value) => {
		const response = await post(reportBody(value));

		expect(response.status).toBe(400);
		expect(mocks.getDeployment).not.toHaveBeenCalled();
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
		expect(mocks.validatePublicHttpUrl).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("authenticates and checks report permission before the Chinese gate", async () => {
		mocks.validateApiKeyFromRequest.mockReturnValue(false);
		let response = await post(reportBody("zh-CN"));
		expect(response.status).toBe(401);
		expect(mocks.getDeployment).not.toHaveBeenCalled();
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();

		mocks.validateApiKeyFromRequest.mockReturnValue(true);
		mocks.getDeployment.mockReturnValue({ features: { reportGeneration: false } });
		response = await post(reportBody("zh-CN"));
		expect(response.status).toBe(403);
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
	});

	it("rejects disabled Chinese writes before URL, database, and queue work", async () => {
		const response = await post(reportBody("zh-CN"));
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE).toBe("report-output-language-temporarily-unavailable");
		expect(body).toMatchObject({
			error: "Service Unavailable",
			code: "report-output-language-temporarily-unavailable",
		});
		expect(body.message).toEqual(expect.any(String));
		expect(mocks.validatePublicHttpUrl).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("does not overwrite the persisted language when queueing fails", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);
		mocks.sendReportJob.mockResolvedValue(false);

		const response = await post(reportBody("zh-CN"));

		expect(response.status).toBe(500);
		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "zh-CN" });
		expect(mocks.updateSets).toEqual([{ status: "failed", updatedAt: expect.any(Date) }]);
	});

	it("lists the persisted outputLanguage without applying the Chinese write gate", async () => {
		mocks.selectResults.push([{ count: 1 }], [reportRow("zh-CN")]);

		const response = await get();

		expect(response.status).toBe(200);
		expect(mocks.selectProjections[1]).toMatchObject({ outputLanguage: "outputLanguage" });
		expect(await response.json()).toMatchObject({
			reports: [{ id: reportId, outputLanguage: "zh-CN" }],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		});
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
	});
});

function post(body: unknown): Promise<Response> {
	const handler = (Route as unknown as MockRoute).server.handlers.POST;
	return handler({
		request: new Request("https://portal.example.test/api/v1/reports", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
			body: JSON.stringify(body),
		}),
		params: {},
	});
}

function get(): Promise<Response> {
	const handler = (Route as unknown as MockRoute).server.handlers.GET;
	return handler({
		request: new Request("https://portal.example.test/api/v1/reports", {
			headers: { Authorization: "Bearer test-key" },
		}),
		params: {},
	});
}
