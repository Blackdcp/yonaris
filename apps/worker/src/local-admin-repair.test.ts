import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	hasOrganizationRole,
	LocalAdminRepairError,
	parseLocalAdminRepairOptions,
	planAdminMembership,
	planCredentialReset,
	selectUniqueBootstrapOwner,
	validateStdinPassword,
} from "./local-admin-repair";

describe("local admin repair input", () => {
	it("defaults the explicit selector to a dry run", () => {
		assert.deepEqual(parseLocalAdminRepairOptions(["--email", " Owner@Example.com ", "--brand-id", "brand-1"]), {
			apply: false,
			resetPassword: false,
			selector: { type: "explicit", email: "owner@example.com", brandId: "brand-1" },
		});
	});

	it("allows a local bootstrap owner without an email guess", () => {
		assert.deepEqual(parseLocalAdminRepairOptions(["--bootstrap-owner", "--apply"]), {
			apply: true,
			resetPassword: false,
			selector: { type: "bootstrap-owner" },
		});
	});

	it("does not allow bootstrap selection to reset a password", () => {
		assert.throws(
			() => parseLocalAdminRepairOptions(["--bootstrap-owner", "--reset-password"]),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "unsafe_bootstrap_password_reset",
		);
	});

	it("rejects password material in command-line options", () => {
		assert.throws(
			() =>
				parseLocalAdminRepairOptions(["--email", "owner@example.com", "--brand-id", "brand-1", "--password", "secret"]),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "unknown_option",
		);
	});
});

describe("local admin repair ambiguity guards", () => {
	it("matches comma-separated organization roles exactly", () => {
		assert.equal(hasOrganizationRole("member, admin", "admin"), true);
		assert.equal(hasOrganizationRole("owner,member", "owner"), true);
		assert.equal(hasOrganizationRole("superadmin", "admin"), false);
	});

	it("requires exactly one bootstrap owner membership", () => {
		assert.throws(
			() =>
				selectUniqueBootstrapOwner([
					{
						membershipId: "member-1",
						userId: "user-1",
						memberRole: "owner",
						userRole: "user",
						hasReportGeneratorAccess: false,
					},
					{
						membershipId: "member-2",
						userId: "user-2",
						memberRole: "admin",
						userRole: "user",
						hasReportGeneratorAccess: false,
					},
				]),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "bootstrap_owner_ambiguous",
		);
	});

	it("fails closed on duplicate organization memberships", () => {
		assert.throws(
			() =>
				planAdminMembership([
					{ id: "member-1", role: "member" },
					{ id: "member-2", role: "member" },
				]),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "membership_ambiguous",
		);
	});

	it("preserves an owner membership instead of downgrading it", () => {
		assert.deepEqual(planAdminMembership([{ id: "member-1", role: "owner" }]), {
			action: "none",
			membershipId: "member-1",
			before: "owner",
			after: "owner",
		});
	});

	it("preserves a multi-role admin membership instead of overwriting it", () => {
		assert.deepEqual(planAdminMembership([{ id: "member-1", role: "member, admin" }]), {
			action: "none",
			membershipId: "member-1",
			before: "member, admin",
			after: "member, admin",
		});
	});

	it("rejects duplicate or cross-linked credential accounts", () => {
		assert.throws(
			() =>
				planCredentialReset(
					[
						{ id: "account-1", userId: "user-1", accountId: "user-1" },
						{ id: "account-2", userId: "user-1", accountId: "user-1" },
					],
					"user-1",
				),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "credential_ambiguous",
		);
		assert.throws(
			() => planCredentialReset([{ id: "account-1", userId: "user-2", accountId: "user-1" }], "user-1"),
			(error: unknown) => error instanceof LocalAdminRepairError && error.code === "credential_malformed",
		);
	});
});

describe("local admin repair password policy", () => {
	it("accepts only the supported stdin password length", () => {
		assert.doesNotThrow(() => validateStdinPassword("a".repeat(12)));
		assert.doesNotThrow(() => validateStdinPassword("a".repeat(128)));
		assert.throws(() => validateStdinPassword("a".repeat(11)));
		assert.throws(() => validateStdinPassword("a".repeat(129)));
		assert.throws(() => validateStdinPassword(`valid-prefix\n${"a".repeat(12)}`));
		assert.throws(() => validateStdinPassword(`valid-prefix\0${"a".repeat(12)}`));
	});
});
