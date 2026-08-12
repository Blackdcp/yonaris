import { MAX_PROMPTS } from "@workspace/lib/constants";
import { describe, expect, it, vi } from "vitest";
import {
	MAX_MEASUREMENT_SCOPES_PER_BRAND,
	type ProvisionSamplingScopeInput,
	provisionManualSamplingScopeWithRepository,
	provisionSamplingScopeInputSchema,
	type SamplingScopeProvisioningRepository,
} from "./sampling-scope-provisioning";

const input: ProvisionSamplingScopeInput = {
	brandId: "stepfun",
	key: "cn-zh-scored",
	name: "China scored",
	market: "CN",
	locale: "zh-CN",
	timezone: "Asia/Shanghai",
	evaluationRole: "scored",
	sourceScopeId: "11111111-1111-4111-8111-111111111111",
};

const insertedScope = {
	id: "22222222-2222-4222-8222-222222222222",
	brandId: input.brandId,
	key: input.key,
	name: input.name,
	market: input.market,
	locale: input.locale,
	timezone: input.timezone,
	automaticTargetKeys: [],
	samplingEvaluationRole: input.evaluationRole,
	enabled: true,
	isDefault: false,
	createdAt: new Date("2026-08-11T00:00:00Z"),
	updatedAt: new Date("2026-08-11T00:00:00Z"),
};

function makeRepository(
	overrides: Partial<SamplingScopeProvisioningRepository> = {},
): SamplingScopeProvisioningRepository {
	return {
		lockBrand: vi.fn(async () => ({ organizationId: "customer-company" })),
		listMembershipRolesForUpdate: vi.fn(async () => ["admin"]),
		countScopesForBrand: vi.fn(async () => 1),
		findScopeIdByKey: vi.fn(async () => null),
		sourceScopeBelongsToBrand: vi.fn(async () => true),
		listSourcePrompts: vi.fn(async () => []),
		insertManualScope: vi.fn(async () => insertedScope),
		insertPromptCopies: vi.fn(async () => undefined),
		...overrides,
	};
}

describe("manual sampling scope provisioning", () => {
	it("creates an enabled, non-default, manual-only scope", async () => {
		const repository = makeRepository();

		const result = await provisionManualSamplingScopeWithRepository({ ...input, sourceScopeId: undefined }, repository);

		expect(repository.insertManualScope).toHaveBeenCalledWith({
			brandId: "stepfun",
			key: "cn-zh-scored",
			name: "China scored",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			automaticTargetKeys: [],
			samplingEvaluationRole: "scored",
			enabled: true,
			isDefault: false,
		});
		expect(repository.listSourcePrompts).not.toHaveBeenCalled();
		expect(repository.insertPromptCopies).not.toHaveBeenCalled();
		expect(result).toEqual({ scope: insertedScope, copiedPromptCount: 0 });
	});

	it("rechecks the authorized organization after locking a brand whose id differs from its tenant", async () => {
		const repository = makeRepository();

		await provisionManualSamplingScopeWithRepository(input, repository, {
			expectedOrganizationId: "customer-company",
			expectedUserId: "user-1",
		});

		expect(repository.lockBrand).toHaveBeenCalledWith("stepfun");
		expect(repository.listMembershipRolesForUpdate).toHaveBeenCalledWith("user-1", "customer-company", 2);
		expect(repository.insertManualScope).toHaveBeenCalledOnce();
	});

	it("fails closed if the brand moves to another organization after authorization", async () => {
		const repository = makeRepository({ lockBrand: vi.fn(async () => ({ organizationId: "other-company" })) });

		await expect(
			provisionManualSamplingScopeWithRepository(input, repository, {
				expectedOrganizationId: "customer-company",
				expectedUserId: "user-1",
			}),
		).rejects.toThrow("Not Found: Brand is not accessible");
		expect(repository.findScopeIdByKey).not.toHaveBeenCalled();
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("rechecks owner/admin membership in the provisioning transaction", async () => {
		const repository = makeRepository({ listMembershipRolesForUpdate: vi.fn(async () => ["member"]) });

		await expect(
			provisionManualSamplingScopeWithRepository(input, repository, {
				expectedOrganizationId: "customer-company",
				expectedUserId: "user-1",
			}),
		).rejects.toThrow("Only organization owners and admins");
		expect(repository.findScopeIdByKey).not.toHaveBeenCalled();
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("fails closed if membership is revoked after the initial access check", async () => {
		const repository = makeRepository({ listMembershipRolesForUpdate: vi.fn(async () => []) });

		await expect(
			provisionManualSamplingScopeWithRepository(input, repository, {
				expectedOrganizationId: "customer-company",
				expectedUserId: "user-1",
			}),
		).rejects.toThrow("Not Found: Brand is not accessible");
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("fails closed if a duplicate membership appears before the transactional recheck", async () => {
		const repository = makeRepository({
			listMembershipRolesForUpdate: vi.fn(async () => ["owner", "member"]),
		});

		await expect(
			provisionManualSamplingScopeWithRepository(input, repository, {
				expectedOrganizationId: "customer-company",
				expectedUserId: "user-1",
			}),
		).rejects.toThrow("Forbidden: Ambiguous organization membership");
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("copies only enabled prompts belonging to the selected brand and source scope", async () => {
		const eligiblePrompt = {
			brandId: input.brandId,
			scopeId: input.sourceScopeId ?? null,
			value: "Which AI platform is suitable?",
			enabled: true,
			tags: ["discovery"],
			systemTags: ["unbranded"],
		};
		const repository = makeRepository({
			listSourcePrompts: vi.fn(async () => [
				eligiblePrompt,
				{ ...eligiblePrompt, value: "disabled", enabled: false },
				{ ...eligiblePrompt, value: "other brand", brandId: "mentensor" },
				{ ...eligiblePrompt, value: "other scope", scopeId: "33333333-3333-4333-8333-333333333333" },
			]),
		});

		const result = await provisionManualSamplingScopeWithRepository(input, repository);

		expect(repository.sourceScopeBelongsToBrand).toHaveBeenCalledWith(input.sourceScopeId, input.brandId);
		expect(repository.listSourcePrompts).toHaveBeenCalledWith(input.brandId, input.sourceScopeId);
		expect(repository.insertPromptCopies).toHaveBeenCalledWith(insertedScope.id, [eligiblePrompt]);
		expect(result.copiedPromptCount).toBe(1);
	});

	it("rejects a prompt source scope from another brand before inserting", async () => {
		const repository = makeRepository({ sourceScopeBelongsToBrand: vi.fn(async () => false) });

		await expect(provisionManualSamplingScopeWithRepository(input, repository)).rejects.toThrow(
			"source scope does not belong to this brand",
		);
		expect(repository.listSourcePrompts).not.toHaveBeenCalled();
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("rejects a duplicate scope key while holding the brand lock", async () => {
		const repository = makeRepository({ findScopeIdByKey: vi.fn(async () => "existing-scope") });

		await expect(provisionManualSamplingScopeWithRepository(input, repository)).rejects.toThrow(
			"already exists for this brand",
		);
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("rejects a new scope at the per-brand limit before inserting", async () => {
		const repository = makeRepository({
			countScopesForBrand: vi.fn(async () => MAX_MEASUREMENT_SCOPES_PER_BRAND),
		});

		await expect(provisionManualSamplingScopeWithRepository(input, repository)).rejects.toThrow(
			`at most ${MAX_MEASUREMENT_SCOPES_PER_BRAND} measurement scopes`,
		);
		expect(repository.findScopeIdByKey).not.toHaveBeenCalled();
		expect(repository.insertManualScope).not.toHaveBeenCalled();
	});

	it("allows creation immediately below the per-brand scope limit", async () => {
		const repository = makeRepository({
			countScopesForBrand: vi.fn(async () => MAX_MEASUREMENT_SCOPES_PER_BRAND - 1),
		});

		await expect(
			provisionManualSamplingScopeWithRepository({ ...input, sourceScopeId: undefined }, repository),
		).resolves.toMatchObject({ scope: insertedScope, copiedPromptCount: 0 });
		expect(repository.insertManualScope).toHaveBeenCalledOnce();
	});

	it("rejects copying more than the prompt limit before inserting the scope", async () => {
		const sourcePrompts = Array.from({ length: MAX_PROMPTS + 1 }, (_, index) => ({
			brandId: input.brandId,
			scopeId: input.sourceScopeId ?? null,
			value: `Prompt ${index + 1}`,
			enabled: true,
			tags: [],
			systemTags: [],
		}));
		const repository = makeRepository({ listSourcePrompts: vi.fn(async () => sourcePrompts) });

		await expect(provisionManualSamplingScopeWithRepository(input, repository)).rejects.toThrow(
			`copy at most ${MAX_PROMPTS} prompts`,
		);
		expect(repository.insertManualScope).not.toHaveBeenCalled();
		expect(repository.insertPromptCopies).not.toHaveBeenCalled();
	});

	it("copies exactly the maximum allowed prompt count", async () => {
		const sourcePrompts = Array.from({ length: MAX_PROMPTS }, (_, index) => ({
			brandId: input.brandId,
			scopeId: input.sourceScopeId ?? null,
			value: `Prompt ${index + 1}`,
			enabled: true,
			tags: [],
			systemTags: [],
		}));
		const repository = makeRepository({ listSourcePrompts: vi.fn(async () => sourcePrompts) });

		const result = await provisionManualSamplingScopeWithRepository(input, repository);

		expect(result.copiedPromptCount).toBe(MAX_PROMPTS);
		expect(repository.insertManualScope).toHaveBeenCalledOnce();
		expect(repository.insertPromptCopies).toHaveBeenCalledWith(insertedScope.id, sourcePrompts);
	});

	it("does not copy prompts when scope insertion fails", async () => {
		const repository = makeRepository({ insertManualScope: vi.fn(async () => null) });

		await expect(provisionManualSamplingScopeWithRepository(input, repository)).rejects.toThrow(
			"Failed to create sampling measurement scope",
		);
		expect(repository.insertPromptCopies).not.toHaveBeenCalled();
	});
});

describe("sampling scope input", () => {
	it("normalizes customer and admin inputs through the shared schema", () => {
		const parsed = provisionSamplingScopeInputSchema.parse({
			...input,
			market: "cn",
			locale: "zh-cn",
			timezone: "Asia/Shanghai",
		});

		expect(parsed).toMatchObject({ market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" });
	});

	it.each([
		{ market: "ZZ", locale: "zh-CN" },
		{ market: "CN", locale: "und" },
	])("rejects legacy unspecified sampling coordinates", (coordinates) => {
		expect(() => provisionSamplingScopeInputSchema.parse({ ...input, ...coordinates })).toThrow();
	});
});
