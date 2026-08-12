import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	getDeployment: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	sendReportJob: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: () => unknown) => handler,
		validator: () => ({ handler: (handler: (args: { data: unknown }) => unknown) => handler }),
	}),
}));

vi.mock("@/lib/auth/helpers", () => ({
	hasReportAccess: (session: { user: { hasReportAccess?: boolean } }) => session.user.hasReportAccess === true,
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
}));

vi.mock("@/lib/config/server", () => ({ getDeployment: mocks.getDeployment }));
vi.mock("@/lib/job-scheduler", () => ({ sendReportJob: mocks.sendReportJob }));
vi.mock("@workspace/lib/db/db", () => ({ db: { select: mocks.select, insert: mocks.insert } }));
vi.mock("@workspace/lib/db/schema", () => ({ reports: {} }));
vi.mock("@workspace/lib/report-output", () => ({ parseGeneratedReportOutput: vi.fn() }));
vi.mock("drizzle-orm", () => ({ desc: vi.fn(), eq: vi.fn() }));

import { createReportFn, getReportsFn } from "./reports";

describe("report execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "platform-1", role: "admin" } });
		mocks.getDeployment.mockReturnValue({ features: { reportGeneration: false } });
	});

	it("denies a global admin when report generation is disabled", async () => {
		await expect(getReportsFn()).rejects.toThrow("Platform report operator access required");
		await expect(
			createReportFn({
				data: { brandName: "StepFun", brandWebsite: "https://stepfun.com", manualPrompts: "What is StepFun?" },
			}),
		).rejects.toThrow("Platform report operator access required");

		expect(mocks.select).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.sendReportJob).not.toHaveBeenCalled();
	});
});
