import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	isPlatformIdentity: vi.fn(),
	resolveCustomerProgramAccess: vi.fn(),
	provisionManualSamplingScope: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator: () => ({
			handler: (handler: (args: { data: unknown }) => unknown) => handler,
		}),
	}),
}));

vi.mock("@workspace/lib/db/db", () => ({ db: {} }));
vi.mock("@workspace/lib/db/schema", () => ({
	brands: {},
	measurementScopes: {},
	member: {},
	prompts: {},
}));
vi.mock("@/lib/auth/helpers", () => ({
	requireAuthSession: mocks.requireAuthSession,
	isPlatformIdentity: mocks.isPlatformIdentity,
}));
vi.mock("@/lib/auth/program-access", () => ({ resolveCustomerProgramAccess: mocks.resolveCustomerProgramAccess }));
vi.mock("./sampling-scope-provisioning", () => ({
	provisionManualSamplingScope: mocks.provisionManualSamplingScope,
	provisionSamplingScopeInputSchema: {},
}));

import { provisionCustomerProgramScopeFn } from "./customer-programs";

const input = {
	brandId: "stepfun",
	key: "cn-zh-scored",
	name: "China scored",
	market: "CN",
	locale: "zh-CN",
	timezone: "Asia/Shanghai",
	evaluationRole: "scored" as const,
};

describe("customer program provisioning handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
		mocks.isPlatformIdentity.mockReturnValue(false);
	});

	it("does not grant a global platform admin a customer-tenant bypass", async () => {
		mocks.isPlatformIdentity.mockReturnValue(true);

		await expect(provisionCustomerProgramScopeFn({ data: input })).rejects.toThrow(
			"Not Found: Customer programs are not available to platform identities",
		);
		expect(mocks.resolveCustomerProgramAccess).not.toHaveBeenCalled();
		expect(mocks.provisionManualSamplingScope).not.toHaveBeenCalled();
	});

	it.each(["analyst", "member", "viewer"])("rejects a direct create call from a %s", async (membershipRole) => {
		mocks.resolveCustomerProgramAccess.mockResolvedValue({
			brand: { id: "stepfun", name: "StepFun", organizationId: "stepfun-company" },
			membershipRole,
			canProvision: false,
		});

		await expect(provisionCustomerProgramScopeFn({ data: input })).rejects.toThrow(
			"Only organization owners and admins",
		);
		expect(mocks.provisionManualSamplingScope).not.toHaveBeenCalled();
	});

	it.each(["owner", "admin"])(
		"passes the %s tenant context into the transactional authorization recheck",
		async (membershipRole) => {
			mocks.resolveCustomerProgramAccess.mockResolvedValue({
				brand: { id: "stepfun", name: "StepFun", organizationId: "stepfun-company" },
				membershipRole,
				canProvision: true,
			});
			mocks.provisionManualSamplingScope.mockResolvedValue({
				scope: { id: "scope-1" },
				copiedPromptCount: 12,
			});

			await expect(provisionCustomerProgramScopeFn({ data: input })).resolves.toEqual({
				scopeId: "scope-1",
				copiedPromptCount: 12,
			});
			expect(mocks.provisionManualSamplingScope).toHaveBeenCalledWith(input, {
				expectedOrganizationId: "stepfun-company",
				expectedUserId: "user-1",
			});
		},
	);
});
