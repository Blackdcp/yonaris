export const CUSTOMER_ORGANIZATION_ROLES = ["owner", "admin", "analyst", "viewer"] as const;

export type CustomerOrganizationRole = (typeof CUSTOMER_ORGANIZATION_ROLES)[number];

export class CustomerAccountOpsError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "CustomerAccountOpsError";
	}
}

export type CustomerAccountCliOptions = {
	apply: boolean;
	resetPassword: boolean;
	revokeSessions: boolean;
	email: string;
	name: string;
	brandId: string;
	organizationRole: CustomerOrganizationRole;
};

const VALUE_OPTIONS = new Set(["--email", "--name", "--brand-id", "--organization-role"]);
const FLAG_OPTIONS = new Set(["--apply", "--reset-password", "--revoke-sessions"]);

export function parseCustomerAccountCliOptions(argv: string[]): CustomerAccountCliOptions {
	const values = new Map<string, string>();
	const flags = new Set<string>();

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (!argument?.startsWith("--")) {
			throw new CustomerAccountOpsError("unexpected_argument", "Only named options are accepted");
		}

		if (FLAG_OPTIONS.has(argument)) {
			if (flags.has(argument)) {
				throw new CustomerAccountOpsError("duplicate_option", "An option was supplied more than once");
			}
			flags.add(argument);
			continue;
		}

		if (!VALUE_OPTIONS.has(argument)) {
			throw new CustomerAccountOpsError("unknown_option", "Unknown option");
		}
		if (values.has(argument)) {
			throw new CustomerAccountOpsError("duplicate_option", "An option was supplied more than once");
		}

		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new CustomerAccountOpsError("missing_option_value", "A required option value is missing");
		}
		values.set(argument, value);
		index++;
	}

	const email = values.get("--email")?.trim().toLowerCase();
	const name = values.get("--name")?.trim();
	const brandId = values.get("--brand-id")?.trim();
	const organizationRole = values.get("--organization-role")?.trim();

	if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new CustomerAccountOpsError("invalid_email", "--email must be a valid email address");
	}
	if (!name || name.length > 200 || /[\r\n\0]/.test(name)) {
		throw new CustomerAccountOpsError(
			"invalid_name",
			"--name must be a single non-empty line of at most 200 characters",
		);
	}
	if (!brandId || brandId.length > 200 || /[\r\n\0]/.test(brandId)) {
		throw new CustomerAccountOpsError("invalid_brand_id", "--brand-id is required");
	}
	if (!CUSTOMER_ORGANIZATION_ROLES.includes(organizationRole as CustomerOrganizationRole)) {
		throw new CustomerAccountOpsError(
			"invalid_organization_role",
			"--organization-role must be owner, admin, analyst, or viewer",
		);
	}

	return {
		apply: flags.has("--apply"),
		resetPassword: flags.has("--reset-password"),
		revokeSessions: flags.has("--revoke-sessions"),
		email,
		name,
		brandId,
		organizationRole: organizationRole as CustomerOrganizationRole,
	};
}

export type CustomerMembershipRow = {
	id: string;
	organizationId: string;
	role: string;
};

export type CustomerAccountRow = {
	id: string;
	providerId: string;
	userId: string;
	accountId: string;
	passwordPresent: boolean;
};

export type ExistingCustomerAccount = {
	userId: string;
	email: string;
	name: string;
	emailVerified: boolean;
	globalRole: string | null;
	hasReportGeneratorAccess: boolean | null;
	banned: boolean | null;
	memberships: CustomerMembershipRow[];
	accounts: CustomerAccountRow[];
	sessionCount: number;
};

export type CustomerAccountPlan = {
	userAction: "create" | "update" | "none";
	membershipAction: "create" | "update" | "none";
	membershipId: string | null;
	credentialAction: "create" | "update" | "none";
	credentialId: string | null;
	revokeSessions: boolean;
	sessionCountBefore: number;
	passwordRequired: boolean;
	changesRequired: boolean;
	storedOrganizationRoleAfter: string;
};

function membershipMatchesProductRole(storedRole: string, requestedRole: CustomerOrganizationRole): boolean {
	return storedRole === requestedRole || (requestedRole === "analyst" && storedRole === "member");
}

function selectCredentialAccount(accounts: CustomerAccountRow[], userId: string): CustomerAccountRow | null {
	if (accounts.some((entry) => entry.providerId !== "credential")) {
		throw new CustomerAccountOpsError(
			"external_identity_collision",
			"The existing email belongs to an account managed by an external identity provider",
		);
	}
	if (accounts.length > 1) {
		throw new CustomerAccountOpsError(
			"credential_ambiguous",
			"Multiple credential accounts intersect the selected user identity",
		);
	}

	const credential = accounts[0];
	if (!credential) return null;
	if (credential.userId !== userId || credential.accountId !== userId) {
		throw new CustomerAccountOpsError(
			"credential_malformed",
			"The credential account does not match the selected user identity",
		);
	}
	return credential;
}

export function planCustomerAccount(
	options: CustomerAccountCliOptions,
	targetOrganizationId: string,
	existing: ExistingCustomerAccount | null,
): CustomerAccountPlan {
	if (!existing) {
		return {
			userAction: "create",
			membershipAction: "create",
			membershipId: null,
			credentialAction: "create",
			credentialId: null,
			revokeSessions: false,
			sessionCountBefore: 0,
			passwordRequired: true,
			changesRequired: true,
			storedOrganizationRoleAfter: options.organizationRole,
		};
	}

	if (existing.globalRole !== null && existing.globalRole !== "user") {
		throw new CustomerAccountOpsError(
			"privileged_global_role_collision",
			"The existing email is not an ordinary global user account",
		);
	}
	if (existing.hasReportGeneratorAccess === true) {
		throw new CustomerAccountOpsError(
			"report_access_collision",
			"The existing email has platform report-generator access",
		);
	}
	if (existing.banned === true) {
		throw new CustomerAccountOpsError("banned_user_collision", "The existing email belongs to a banned account");
	}
	if (!existing.emailVerified) {
		throw new CustomerAccountOpsError(
			"unverified_user_collision",
			"The existing email has not been verified and cannot be adopted as an internal QA account",
		);
	}

	const foreignMemberships = existing.memberships.filter(
		(membership) => membership.organizationId !== targetOrganizationId,
	);
	if (foreignMemberships.length > 0) {
		throw new CustomerAccountOpsError(
			"cross_organization_collision",
			"The existing email already belongs to another customer organization",
		);
	}
	const targetMemberships = existing.memberships.filter(
		(membership) => membership.organizationId === targetOrganizationId,
	);
	if (targetMemberships.length > 1) {
		throw new CustomerAccountOpsError(
			"membership_ambiguous",
			"Multiple memberships exist for the selected user and organization",
		);
	}

	const credential = selectCredentialAccount(existing.accounts, existing.userId);
	if (!credential?.passwordPresent && !options.resetPassword) {
		throw new CustomerAccountOpsError(
			"credential_missing",
			"The existing internal customer account has no password credential; use --reset-password to create one",
		);
	}

	const membership = targetMemberships[0];
	const membershipAction = !membership
		? "create"
		: membershipMatchesProductRole(membership.role, options.organizationRole)
			? "none"
			: "update";
	const userAction =
		existing.email !== options.email ||
		existing.name !== options.name ||
		existing.globalRole !== "user" ||
		existing.hasReportGeneratorAccess !== false ||
		existing.banned !== false
			? "update"
			: "none";
	const credentialAction = options.resetPassword ? (credential ? "update" : "create") : "none";
	const authStateChanges =
		membershipAction !== "none" ||
		existing.globalRole !== "user" ||
		existing.hasReportGeneratorAccess !== false ||
		existing.banned !== false ||
		credentialAction !== "none";
	const revokeSessions = options.revokeSessions || authStateChanges;

	return {
		userAction,
		membershipAction,
		membershipId: membership?.id ?? null,
		credentialAction,
		credentialId: credential?.id ?? null,
		revokeSessions,
		sessionCountBefore: existing.sessionCount,
		passwordRequired: credentialAction !== "none",
		changesRequired:
			userAction !== "none" ||
			membershipAction !== "none" ||
			credentialAction !== "none" ||
			(revokeSessions && existing.sessionCount > 0),
		storedOrganizationRoleAfter: membershipAction === "none" && membership ? membership.role : options.organizationRole,
	};
}

export function validateCustomerAccountPassword(password: string): void {
	if (/[\r\n\0]/.test(password)) {
		throw new CustomerAccountOpsError(
			"invalid_password_characters",
			"Password supplied on stdin must be a single line without NUL characters",
		);
	}
	if (password.length < 12 || password.length > 128) {
		throw new CustomerAccountOpsError(
			"invalid_password_length",
			"Password supplied on stdin must be between 12 and 128 characters",
		);
	}
}
