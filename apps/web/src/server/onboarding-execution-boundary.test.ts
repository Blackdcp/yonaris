import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	requireBrandAccess: vi.fn(),
	enqueueAnalyzeBrand: vi.fn(),
	getAnalyzeBrandStatus: vi.fn(),
	cancelAnalyzeBrand: vi.fn(),
	saveWizardOnboarding: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator: () => ({ handler: (handler: (args: { data: unknown }) => unknown) => handler }),
	}),
}));

vi.mock("@workspace/lib/public-http-url", () => ({
	validatePublicHttpUrl: vi.fn(async (value: string) => new URL(value)),
}));

vi.mock("@/lib/auth/helpers", () => ({
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
	requireBrandAccess: mocks.requireBrandAccess,
}));

vi.mock("@/lib/analyze-brand-job", () => ({
	enqueueAnalyzeBrand: mocks.enqueueAnalyzeBrand,
	getAnalyzeBrandStatus: mocks.getAnalyzeBrandStatus,
	cancelAnalyzeBrand: mocks.cancelAnalyzeBrand,
}));

vi.mock("@/server/onboarding-core", () => ({
	saveWizardOnboarding: mocks.saveWizardOnboarding,
	wizardOnboardingInputSchema: {},
}));

import {
	cancelAnalyzeBrandFn,
	getAnalyzeBrandStatusFn,
	startAnalyzeBrandFn,
	updateOnboardedBrandFn,
} from "./onboarding";

describe("onboarding execution boundary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("does not let a customer start, cancel, or persist the execution workflow", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });

		await expect(startAnalyzeBrandFn({ data: { brandId: "stepfun", website: "https://stepfun.com" } })).rejects.toThrow(
			"Platform administrator",
		);
		await expect(cancelAnalyzeBrandFn({ data: { brandId: "stepfun" } })).rejects.toThrow("Platform administrator");
		await expect(
			updateOnboardedBrandFn({ data: { brandId: "stepfun", prompts: [{ value: "What is StepFun?" }] } }),
		).rejects.toThrow("Platform administrator");

		expect(mocks.enqueueAnalyzeBrand).not.toHaveBeenCalled();
		expect(mocks.cancelAnalyzeBrand).not.toHaveBeenCalled();
		expect(mocks.saveWizardOnboarding).not.toHaveBeenCalled();
	});

	it("keeps status tenant-readable through the brand's owning organization", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.getAnalyzeBrandStatus.mockResolvedValue({ status: "complete" });

		await expect(getAnalyzeBrandStatusFn({ data: { brandId: "stepfun" } })).resolves.toEqual({
			status: "complete",
		});
		expect(mocks.requireBrandAccess).toHaveBeenCalledWith("customer-1", "stepfun");
	});

	it("preserves the platform administrator execution path", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "platform-1", role: "admin" } });
		mocks.enqueueAnalyzeBrand.mockResolvedValue(undefined);
		mocks.cancelAnalyzeBrand.mockResolvedValue(undefined);
		mocks.saveWizardOnboarding.mockResolvedValue({ ok: true });

		await expect(
			startAnalyzeBrandFn({ data: { brandId: "stepfun", website: "https://stepfun.com" } }),
		).resolves.toEqual({ ok: true });
		await expect(cancelAnalyzeBrandFn({ data: { brandId: "stepfun" } })).resolves.toEqual({ ok: true });
		await expect(
			updateOnboardedBrandFn({ data: { brandId: "stepfun", prompts: [{ value: "What is StepFun?" }] } }),
		).resolves.toEqual({ ok: true });
		expect(mocks.requireBrandAccess).not.toHaveBeenCalled();
	});
});
