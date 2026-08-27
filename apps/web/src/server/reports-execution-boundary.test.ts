import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
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

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: (...args: never[]) => unknown) => handler,
		validator: (schema: { parse: (value: unknown) => unknown }) => ({
			handler: (handler: (args: { data: unknown }) => unknown) => async (args: { data: unknown }) =>
				handler({ data: schema.parse(args.data) }),
		}),
	}),
}));

vi.mock("@/lib/auth/helpers", () => ({
	hasReportAccess: (session: { user: { hasReportAccess?: boolean } }) => session.user.hasReportAccess === true,
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
}));

vi.mock("@/lib/config/server", () => ({ getDeployment: mocks.getDeployment }));
vi.mock("@/lib/job-scheduler", () => ({ sendReportJob: mocks.sendReportJob }));
vi.mock("@workspace/config/artifact-output-language", () => ({
	isArtifactZhCnWriteEnabled: mocks.isArtifactZhCnWriteEnabled,
}));
vi.mock("@workspace/lib/public-http-url", () => ({ validatePublicHttpUrl: mocks.validatePublicHttpUrl }));
vi.mock("@workspace/lib/db/db", () => ({
	db: {
		select: mocks.select,
		insert: mocks.insert,
		update: mocks.update,
	},
}));
vi.mock("@workspace/lib/db/schema", () => ({
	reports: {
		id: "id",
		brandName: "brandName",
		brandWebsite: "brandWebsite",
		status: "status",
		outputLanguage: "outputLanguage",
		progress: "progress",
		rawOutput: "rawOutput",
		createdAt: "createdAt",
		completedAt: "completedAt",
		updatedAt: "updatedAt",
	},
}));
vi.mock("@workspace/lib/report-output", () => ({ parseGeneratedReportOutput: (value: unknown) => value }));
vi.mock("drizzle-orm", () => ({
	desc: (value: unknown) => ({ desc: value }),
	eq: (left: unknown, right: unknown) => ({ left, right }),
}));

import {
	createReportFn,
	getReportByIdFn,
	getReportsFn,
	REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE,
} from "./reports";

const reportId = "73000000-0000-4000-8000-000000000001";
const createdAt = new Date("2026-08-20T08:00:00.000Z");

function reportRow(outputLanguage: "en" | "zh-CN") {
	return {
		id: reportId,
		brandName: "StepFun",
		brandWebsite: "https://stepfun.com/原始路径",
		status: "pending",
		outputLanguage,
		progress: 0,
		rawOutput: null,
		createdAt,
		completedAt: null,
		updatedAt: createdAt,
	};
}

function createInput(outputLanguage: "en" | "zh-CN") {
	return {
		brandName: " StepFun ",
		brandWebsite: "https://stepfun.com/原始路径",
		manualPrompts: "原始 Prompt / Raw Prompt",
		outputLanguage,
	};
}

describe("report execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectResults.length = 0;
		mocks.selectProjections.length = 0;
		mocks.insertResults.length = 0;
		mocks.insertValues.length = 0;
		mocks.updateSets.length = 0;

		mocks.requireAuthSession.mockResolvedValue({
			user: { id: "platform-1", role: "admin", hasReportAccess: true },
		});
		mocks.getDeployment.mockReturnValue({ features: { reportGeneration: true } });
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(false);
		mocks.validatePublicHttpUrl.mockResolvedValue({ href: "https://stepfun.com/原始路径" });
		mocks.sendReportJob.mockResolvedValue(true);

		mocks.select.mockImplementation((projection?: unknown) => {
			mocks.selectProjections.push(projection);
			const rows = mocks.selectResults.shift() ?? [];
			return {
				from: () => ({
					orderBy: () => Promise.resolve(rows),
					where: () => ({ limit: () => Promise.resolve(rows) }),
				}),
			};
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

	it.each([undefined, "zh", "CN", "zh-SG"])(
		"requires one exact output language before any side effect (%s)",
		async (outputLanguage) => {
			await expect(
				createReportFn({
					data: {
						brandName: "StepFun",
						brandWebsite: "https://stepfun.com",
						outputLanguage,
					} as never,
				}),
			).rejects.toThrow();

			expect(mocks.requireAuthSession).not.toHaveBeenCalled();
			expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
			expect(mocks.validatePublicHttpUrl).not.toHaveBeenCalled();
			expect(mocks.insert).not.toHaveBeenCalled();
			expect(mocks.sendReportJob).not.toHaveBeenCalled();
		},
	);

	it("checks report authorization before the Chinese write gate", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "platform-1", role: "admin" } });
		mocks.getDeployment.mockReturnValue({ features: { reportGeneration: false } });

		await expect(createReportFn({ data: createInput("zh-CN") })).rejects.toThrow(
			"Platform report operator access required",
		);

		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
		expect(mocks.validatePublicHttpUrl).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("rejects disabled Chinese generation before URL, database, or queue work", async () => {
		expect(REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE).toBe("report-output-language-temporarily-unavailable");
		await expect(createReportFn({ data: createInput("zh-CN") })).rejects.toMatchObject({
			message: "report-output-language-temporarily-unavailable",
		});

		expect(mocks.isArtifactZhCnWriteEnabled).toHaveBeenCalledOnce();
		expect(mocks.validatePublicHttpUrl).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("queues and returns the strictly parsed persisted language even when it differs from the request", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);

		const result = await createReportFn({ data: createInput("en") });

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
		expect(result).toMatchObject({ id: reportId, outputLanguage: "zh-CN", rawOutput: null });
	});

	it("fails closed and marks the row failed when persisted Chinese is not enabled", async () => {
		mocks.insertResults.push([reportRow("zh-CN")]);

		await expect(createReportFn({ data: createInput("en") })).rejects.toMatchObject({
			message: "report-output-language-temporarily-unavailable",
		});

		expect(mocks.updateSets).toEqual([{ status: "failed", updatedAt: expect.any(Date) }]);
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("rejects an invalid persisted language before queueing", async () => {
		mocks.insertResults.push([{ ...reportRow("en"), outputLanguage: "zh-SG" }]);

		await expect(createReportFn({ data: createInput("en") })).rejects.toThrow(
			"Invalid persisted report output language",
		);

		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "en" });
		expect(mocks.updateSets).toEqual([{ status: "failed", updatedAt: expect.any(Date) }]);
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});

	it("persists and queues Simplified Chinese when its write gate is enabled", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);

		await createReportFn({ data: createInput("zh-CN") });

		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "zh-CN" });
		expect(mocks.sendReportJob).toHaveBeenCalledWith({
			reportId,
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com/原始路径",
			outputLanguage: "zh-CN",
			manualPrompts: ["原始 Prompt / Raw Prompt"],
		});
	});

	it("keeps the persisted language when queueing fails", async () => {
		mocks.isArtifactZhCnWriteEnabled.mockReturnValue(true);
		mocks.insertResults.push([reportRow("zh-CN")]);
		mocks.sendReportJob.mockResolvedValue(false);

		await expect(createReportFn({ data: createInput("zh-CN") })).rejects.toThrow("Failed to queue report generation");

		expect(mocks.insertValues[0]).toMatchObject({ outputLanguage: "zh-CN" });
		expect(mocks.updateSets).toHaveLength(1);
		expect(mocks.updateSets[0]).toEqual({ status: "failed", updatedAt: expect.any(Date) });
	});

	it("includes outputLanguage in report list and detail reads without applying the write gate", async () => {
		mocks.selectResults.push([reportRow("zh-CN")], [reportRow("zh-CN")]);

		const list = await getReportsFn();
		const detail = await getReportByIdFn({ data: { reportId } });

		expect(mocks.selectProjections[0]).toMatchObject({ outputLanguage: "outputLanguage" });
		expect(list).toEqual([reportRow("zh-CN")]);
		expect(detail).toMatchObject({ id: reportId, outputLanguage: "zh-CN" });
		expect(mocks.isArtifactZhCnWriteEnabled).not.toHaveBeenCalled();
	});
});
