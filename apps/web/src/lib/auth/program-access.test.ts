import { describe, expect, it, vi } from "vitest";
import { type CustomerProgramAccessStore, resolveCustomerProgramAccess } from "./program-access";

function storeFor(input: {
	brand?: { id: string; name: string; organizationId: string } | null;
	membershipRoles?: string[];
}): CustomerProgramAccessStore {
	return {
		findBrand: vi.fn(async () => input.brand ?? null),
		listMembershipRoles: vi.fn(async () => input.membershipRoles ?? []),
	};
}

describe("customer program tenant access", () => {
	it("resolves membership through brand.organizationId instead of assuming brand id is the tenant", async () => {
		const store = storeFor({
			brand: { id: "stepfun", name: "StepFun", organizationId: "customer-company" },
			membershipRoles: ["admin"],
		});

		const access = await resolveCustomerProgramAccess({ userId: "user-1", brandId: "stepfun" }, store);

		expect(store.listMembershipRoles).toHaveBeenCalledWith("user-1", "customer-company", 2);
		expect(access).toMatchObject({ membershipRole: "admin", canProvision: true });
	});

	it("denies a user whose membership belongs to another tenant", async () => {
		const store = storeFor({
			brand: { id: "brand-b", name: "Brand B", organizationId: "org-b" },
			membershipRoles: [],
		});

		await expect(resolveCustomerProgramAccess({ userId: "org-a-user", brandId: "brand-b" }, store)).rejects.toThrow(
			"Not Found: Brand is not accessible",
		);
	});

	it.each(["member", "viewer"])("allows %s to read context but not provision", async (membershipRole) => {
		const store = storeFor({
			brand: { id: "brand-a", name: "Brand A", organizationId: "org-a" },
			membershipRoles: [membershipRole],
		});

		const access = await resolveCustomerProgramAccess({ userId: "user-1", brandId: "brand-a" }, store);

		expect(access.canProvision).toBe(false);
	});

	it("fails closed when corrupt duplicate memberships disagree", async () => {
		const store = storeFor({
			brand: { id: "brand-a", name: "Brand A", organizationId: "org-a" },
			membershipRoles: ["member", "admin"],
		});

		await expect(resolveCustomerProgramAccess({ userId: "user-1", brandId: "brand-a" }, store)).rejects.toThrow(
			"Forbidden: Ambiguous organization membership",
		);
	});

	it("does not model or grant a global-admin bypass", async () => {
		const store = storeFor({
			brand: { id: "brand-a", name: "Brand A", organizationId: "org-a" },
			membershipRoles: [],
		});

		await expect(resolveCustomerProgramAccess({ userId: "global-admin", brandId: "brand-a" }, store)).rejects.toThrow(
			"Not Found: Brand is not accessible",
		);
	});
});
