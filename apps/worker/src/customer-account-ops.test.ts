import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type CustomerAccountCliOptions,
	CustomerAccountOpsError,
	type ExistingCustomerAccount,
	parseCustomerAccountCliOptions,
	planCustomerAccount,
	validateCustomerAccountPassword,
} from "./customer-account-ops";

const options: CustomerAccountCliOptions = {
	apply: false,
	resetPassword: false,
	revokeSessions: false,
	email: "stepfun-owner-qa@example.com",
	name: "StepFun Owner QA",
	brandId: "stepfun",
	organizationRole: "owner",
};

function existing(overrides: Partial<ExistingCustomerAccount> = {}): ExistingCustomerAccount {
	return {
		userId: "user-1",
		email: options.email,
		name: options.name,
		emailVerified: true,
		globalRole: "user",
		hasReportGeneratorAccess: false,
		banned: false,
		memberships: [{ id: "member-1", organizationId: "stepfun-org", role: "owner" }],
		accounts: [
			{
				id: "account-1",
				providerId: "credential",
				userId: "user-1",
				accountId: "user-1",
				passwordPresent: true,
			},
		],
		sessionCount: 0,
		...overrides,
	};
}

describe("customer account CLI input", () => {
	it("defaults to a dry run and accepts only the fixed customer organization roles", () => {
		assert.deepEqual(
			parseCustomerAccountCliOptions([
				"--email",
				" StepFun-Owner-QA@Example.com ",
				"--name",
				" StepFun Owner QA ",
				"--brand-id",
				"stepfun",
				"--organization-role",
				"owner",
			]),
			options,
		);
		for (const role of ["owner", "admin", "analyst", "viewer"]) {
			assert.equal(
				parseCustomerAccountCliOptions([
					"--email",
					options.email,
					"--name",
					options.name,
					"--brand-id",
					options.brandId,
					"--organization-role",
					role,
				]).organizationRole,
				role,
			);
		}
		assert.throws(
			() =>
				parseCustomerAccountCliOptions([
					"--email",
					options.email,
					"--name",
					options.name,
					"--brand-id",
					options.brandId,
					"--organization-role",
					"member",
				]),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "invalid_organization_role",
		);
	});

	it("never accepts password material in argv or exposes it in an error", () => {
		const secretBearingOption = "--password=must-not-appear-in-output";
		assert.throws(
			() => parseCustomerAccountCliOptions([secretBearingOption]),
			(error: unknown) =>
				error instanceof CustomerAccountOpsError &&
				error.code === "unknown_option" &&
				!error.message.includes("must-not-appear-in-output"),
		);
	});
});

describe("customer account isolation and idempotency", () => {
	it("plans a credential-backed ordinary global user for a new email", () => {
		assert.deepEqual(planCustomerAccount(options, "stepfun-org", null), {
			userAction: "create",
			membershipAction: "create",
			membershipId: null,
			credentialAction: "create",
			credentialId: null,
			revokeSessions: false,
			sessionCountBefore: 0,
			passwordRequired: true,
			changesRequired: true,
			storedOrganizationRoleAfter: "owner",
		});
	});

	it("is a no-op when the safe customer account already has the requested state", () => {
		assert.deepEqual(planCustomerAccount(options, "stepfun-org", existing()), {
			userAction: "none",
			membershipAction: "none",
			membershipId: "member-1",
			credentialAction: "none",
			credentialId: "account-1",
			revokeSessions: false,
			sessionCountBefore: 0,
			passwordRequired: false,
			changesRequired: false,
			storedOrganizationRoleAfter: "owner",
		});
	});

	it("fails closed for global admins, report users, and cross-customer memberships", () => {
		assert.throws(
			() => planCustomerAccount(options, "stepfun-org", existing({ globalRole: "admin" })),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "privileged_global_role_collision",
		);
		assert.throws(
			() => planCustomerAccount(options, "stepfun-org", existing({ hasReportGeneratorAccess: true })),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "report_access_collision",
		);
		assert.throws(
			() => planCustomerAccount(options, "stepfun-org", existing({ banned: true })),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "banned_user_collision",
		);
		assert.throws(
			() => planCustomerAccount(options, "stepfun-org", existing({ emailVerified: false })),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "unverified_user_collision",
		);
		assert.throws(
			() =>
				planCustomerAccount(
					options,
					"stepfun-org",
					existing({
						memberships: [
							{ id: "member-1", organizationId: "stepfun-org", role: "owner" },
							{ id: "member-2", organizationId: "memtensor-org", role: "viewer" },
						],
					}),
				),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "cross_organization_collision",
		);
	});

	it("updates an organization role and automatically revokes stale sessions", () => {
		assert.deepEqual(
			planCustomerAccount({ ...options, organizationRole: "viewer" }, "stepfun-org", existing({ sessionCount: 2 })),
			{
				userAction: "none",
				membershipAction: "update",
				membershipId: "member-1",
				credentialAction: "none",
				credentialId: "account-1",
				revokeSessions: true,
				sessionCountBefore: 2,
				passwordRequired: false,
				changesRequired: true,
				storedOrganizationRoleAfter: "viewer",
			},
		);
	});

	it("exposes analyst while preserving a compatible legacy member membership", () => {
		const plan = planCustomerAccount(
			{ ...options, organizationRole: "analyst" },
			"stepfun-org",
			existing({ memberships: [{ id: "member-1", organizationId: "stepfun-org", role: "member" }] }),
		);
		assert.equal(plan.membershipAction, "none");
		assert.equal(plan.storedOrganizationRoleAfter, "member");
		assert.equal(plan.changesRequired, false);
	});

	it("supports explicit session revocation and stdin password reset", () => {
		const revokePlan = planCustomerAccount(
			{ ...options, revokeSessions: true },
			"stepfun-org",
			existing({ sessionCount: 3 }),
		);
		assert.equal(revokePlan.revokeSessions, true);
		assert.equal(revokePlan.passwordRequired, false);

		const resetPlan = planCustomerAccount(
			{ ...options, resetPassword: true },
			"stepfun-org",
			existing({ sessionCount: 1 }),
		);
		assert.equal(resetPlan.credentialAction, "update");
		assert.equal(resetPlan.passwordRequired, true);
		assert.equal(resetPlan.revokeSessions, true);

		const emptyRevokePlan = planCustomerAccount({ ...options, revokeSessions: true }, "stepfun-org", existing());
		assert.equal(emptyRevokePlan.revokeSessions, true);
		assert.equal(emptyRevokePlan.changesRequired, false);
	});

	it("will not attach an internal password to an external or malformed identity", () => {
		assert.throws(
			() =>
				planCustomerAccount(
					{ ...options, resetPassword: true },
					"stepfun-org",
					existing({
						accounts: [
							{
								id: "account-1",
								providerId: "google",
								userId: "user-1",
								accountId: "google-user",
								passwordPresent: false,
							},
						],
					}),
				),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "external_identity_collision",
		);
		assert.throws(
			() =>
				planCustomerAccount(
					options,
					"stepfun-org",
					existing({
						accounts: [
							{
								id: "account-1",
								providerId: "credential",
								userId: "user-1",
								accountId: "other-user",
								passwordPresent: true,
							},
						],
					}),
				),
			(error: unknown) => error instanceof CustomerAccountOpsError && error.code === "credential_malformed",
		);
	});
});

describe("customer account password input", () => {
	it("accepts only a single stdin line between 12 and 128 characters", () => {
		assert.doesNotThrow(() => validateCustomerAccountPassword("a".repeat(12)));
		assert.doesNotThrow(() => validateCustomerAccountPassword("a".repeat(128)));
		assert.throws(() => validateCustomerAccountPassword("a".repeat(11)));
		assert.throws(() => validateCustomerAccountPassword("a".repeat(129)));
		assert.throws(() => validateCustomerAccountPassword(`valid-prefix\n${"a".repeat(12)}`));
		assert.throws(() => validateCustomerAccountPassword(`valid-prefix\0${"a".repeat(12)}`));
	});
});
