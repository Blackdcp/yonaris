export class LocalAdminRepairError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "LocalAdminRepairError";
	}
}

type ExplicitSelector = {
	type: "explicit";
	email: string;
	brandId: string;
};

type BootstrapOwnerSelector = {
	type: "bootstrap-owner";
};

export type LocalAdminRepairOptions = {
	apply: boolean;
	resetPassword: boolean;
	selector: ExplicitSelector | BootstrapOwnerSelector;
};

const VALUE_OPTIONS = new Set(["--email", "--brand-id"]);
const FLAG_OPTIONS = new Set(["--apply", "--reset-password", "--bootstrap-owner"]);

export function parseLocalAdminRepairOptions(argv: string[]): LocalAdminRepairOptions {
	const values = new Map<string, string>();
	const flags = new Set<string>();

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (!argument?.startsWith("--")) {
			throw new LocalAdminRepairError("unexpected_argument", "Only named options are accepted");
		}

		if (FLAG_OPTIONS.has(argument)) {
			if (flags.has(argument)) {
				throw new LocalAdminRepairError("duplicate_option", `Option ${argument} may only be supplied once`);
			}
			flags.add(argument);
			continue;
		}

		if (!VALUE_OPTIONS.has(argument)) {
			throw new LocalAdminRepairError("unknown_option", "Unknown option");
		}
		if (values.has(argument)) {
			throw new LocalAdminRepairError("duplicate_option", `Option ${argument} may only be supplied once`);
		}

		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new LocalAdminRepairError("missing_option_value", `Missing value for ${argument}`);
		}
		values.set(argument, value);
		index++;
	}

	const apply = flags.has("--apply");
	const resetPassword = flags.has("--reset-password");
	const bootstrapOwner = flags.has("--bootstrap-owner");
	const rawEmail = values.get("--email")?.trim();
	const brandId = values.get("--brand-id")?.trim();

	if (bootstrapOwner) {
		if (rawEmail || brandId) {
			throw new LocalAdminRepairError(
				"conflicting_selector",
				"--bootstrap-owner cannot be combined with --email or --brand-id",
			);
		}
		if (resetPassword) {
			throw new LocalAdminRepairError(
				"unsafe_bootstrap_password_reset",
				"--bootstrap-owner cannot be combined with --reset-password",
			);
		}
		return { apply, resetPassword: false, selector: { type: "bootstrap-owner" } };
	}

	if (!rawEmail || !brandId) {
		throw new LocalAdminRepairError(
			"explicit_selector_required",
			"Supply both --email and --brand-id, or use --bootstrap-owner",
		);
	}

	const email = rawEmail.toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new LocalAdminRepairError("invalid_email", "--email must be a valid email address");
	}

	return {
		apply,
		resetPassword,
		selector: { type: "explicit", email, brandId },
	};
}

export type BootstrapOwnerCandidate = {
	membershipId: string;
	organizationId: string;
	userId: string;
	memberRole: string;
	userRole: string | null;
	hasReportGeneratorAccess: boolean | null;
};

export function hasOrganizationRole(value: string, expected: "owner" | "admin"): boolean {
	return value
		.split(",")
		.map((role) => role.trim())
		.some((role) => role === expected);
}

export function selectUniqueBootstrapOwner(candidates: BootstrapOwnerCandidate[]): BootstrapOwnerCandidate {
	const privilegedCandidates = candidates.filter(
		(candidate) =>
			hasOrganizationRole(candidate.memberRole, "owner") || hasOrganizationRole(candidate.memberRole, "admin"),
	);
	const selected = privilegedCandidates[0];
	if (!selected) {
		throw new LocalAdminRepairError("bootstrap_owner_not_found", "No organization has an owner/admin member");
	}

	const uniqueUserIds = new Set(privilegedCandidates.map((candidate) => candidate.userId));
	if (uniqueUserIds.size !== 1) {
		throw new LocalAdminRepairError(
			"bootstrap_owner_ambiguous",
			"The deployment has more than one distinct organization owner/admin",
		);
	}

	return [...privilegedCandidates].sort((left, right) => {
		if (left.organizationId !== right.organizationId) {
			return left.organizationId < right.organizationId ? -1 : 1;
		}
		if (left.membershipId === right.membershipId) return 0;
		return left.membershipId < right.membershipId ? -1 : 1;
	})[0] as BootstrapOwnerCandidate;
}

export type MembershipRow = { id: string; role: string };
export type MembershipPlan =
	| { action: "create"; membershipId: null; before: null; after: "admin" }
	| { action: "promote"; membershipId: string; before: string; after: "admin" }
	| { action: "none"; membershipId: string; before: string; after: string };

export function planAdminMembership(rows: MembershipRow[]): MembershipPlan {
	if (rows.length > 1) {
		throw new LocalAdminRepairError(
			"membership_ambiguous",
			"Multiple memberships exist for the selected user and organization",
		);
	}

	const existing = rows[0];
	if (!existing) return { action: "create", membershipId: null, before: null, after: "admin" };
	if (hasOrganizationRole(existing.role, "admin") || hasOrganizationRole(existing.role, "owner")) {
		return {
			action: "none",
			membershipId: existing.id,
			before: existing.role,
			after: existing.role,
		};
	}
	return { action: "promote", membershipId: existing.id, before: existing.role, after: "admin" };
}

export type CredentialRow = {
	id: string;
	userId: string;
	accountId: string;
};

export type CredentialPlan = { action: "create"; accountId: null } | { action: "update"; accountId: string };

export function planCredentialReset(rows: CredentialRow[], targetUserId: string): CredentialPlan {
	if (rows.length === 0) return { action: "create", accountId: null };
	if (rows.length !== 1) {
		throw new LocalAdminRepairError(
			"credential_ambiguous",
			"Multiple credential accounts intersect the selected user identity",
		);
	}

	const credential = rows[0];
	if (!credential) {
		throw new LocalAdminRepairError("credential_not_found", "The credential account could not be selected");
	}
	if (credential.userId !== targetUserId || credential.accountId !== targetUserId) {
		throw new LocalAdminRepairError(
			"credential_malformed",
			"The credential account does not match Better Auth's user identity contract",
		);
	}
	return { action: "update", accountId: credential.id };
}

export function validateStdinPassword(password: string): void {
	if (/[\r\n\0]/.test(password)) {
		throw new LocalAdminRepairError(
			"invalid_password_characters",
			"Password supplied on stdin must be a single line without NUL characters",
		);
	}
	if (password.length < 12 || password.length > 128) {
		throw new LocalAdminRepairError(
			"invalid_password_length",
			"Password supplied on stdin must be between 12 and 128 characters",
		);
	}
}
