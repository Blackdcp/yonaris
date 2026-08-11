import { evaluateCustomerProgramProvisionAccess } from "./program-policies";

export interface CustomerProgramBrand {
	id: string;
	name: string;
	organizationId: string;
}

export interface CustomerProgramAccessStore {
	findBrand(brandId: string): Promise<CustomerProgramBrand | null>;
	listMembershipRoles(userId: string, organizationId: string, limit: number): Promise<string[]>;
}

export async function resolveCustomerProgramAccess(
	input: { userId: string; brandId: string },
	store: CustomerProgramAccessStore,
): Promise<{ brand: CustomerProgramBrand; membershipRole: string; canProvision: boolean }> {
	const brand = await store.findBrand(input.brandId);
	if (!brand) throw new Error("Not Found: Brand is not accessible");

	const membershipRoles = await store.listMembershipRoles(input.userId, brand.organizationId, 2);
	if (membershipRoles.length === 0) throw new Error("Not Found: Brand is not accessible");
	if (membershipRoles.length > 1) {
		throw new Error("Forbidden: Ambiguous organization membership");
	}

	const membershipRole = membershipRoles[0];
	if (!membershipRole) throw new Error("Forbidden: Invalid organization membership");
	return {
		brand,
		membershipRole,
		canProvision: evaluateCustomerProgramProvisionAccess(membershipRole) === "allow",
	};
}
