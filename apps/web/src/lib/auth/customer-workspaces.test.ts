import { describe, expect, it } from "vitest";
import { buildCustomerWorkspaceLinks } from "./helpers";

describe("buildCustomerWorkspaceLinks", () => {
	it("uses a brand resource id even when it differs from the organization id", () => {
		expect(
			buildCustomerWorkspaceLinks([
				{
					membershipId: "membership-1",
					organizationId: "stepfun-company",
					organizationName: "StepFun organization",
					brandId: "stepfun",
					brandName: "StepFun",
				},
			]),
		).toEqual([
			{
				id: "stepfun",
				name: "StepFun",
				organizationId: "stepfun-company",
				needsOnboarding: false,
			},
		]);
	});

	it("uses the organization id only for an explicit pre-brand onboarding target", () => {
		expect(
			buildCustomerWorkspaceLinks([
				{
					membershipId: "membership-1",
					organizationId: "new-customer",
					organizationName: "New Customer",
					brandId: null,
					brandName: null,
				},
			]),
		).toEqual([
			{
				id: "new-customer",
				name: "New Customer",
				organizationId: "new-customer",
				needsOnboarding: true,
			},
		]);
	});

	it("fails closed for duplicate memberships or multiple brands in one organization", () => {
		const base = {
			organizationId: "ambiguous",
			organizationName: "Ambiguous",
			brandName: "Brand",
		};
		expect(() =>
			buildCustomerWorkspaceLinks([
				{ ...base, membershipId: "membership-1", brandId: "brand-1" },
				{ ...base, membershipId: "membership-2", brandId: "brand-1" },
			]),
		).toThrow("Customer workspace membership is ambiguous");
		expect(() =>
			buildCustomerWorkspaceLinks([
				{ ...base, membershipId: "membership-1", brandId: "brand-1" },
				{ ...base, membershipId: "membership-1", brandId: "brand-2" },
			]),
		).toThrow("Customer workspace membership is ambiguous");
	});
});
