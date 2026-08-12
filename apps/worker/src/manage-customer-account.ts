import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "@workspace/lib/auth/password";
import { db } from "@workspace/lib/db/db";
import { account, brands, member, session, user } from "@workspace/lib/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import {
	type CustomerAccountCliOptions,
	CustomerAccountOpsError,
	type ExistingCustomerAccount,
	parseCustomerAccountCliOptions,
	planCustomerAccount,
	validateCustomerAccountPassword,
} from "./customer-account-ops";

async function readPasswordFromStdin(): Promise<string> {
	if (process.stdin.isTTY) {
		throw new CustomerAccountOpsError(
			"password_stdin_required",
			"Password input must be piped or redirected through stdin",
		);
	}

	let input = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) {
		input += chunk;
		if (input.length > 130) {
			throw new CustomerAccountOpsError(
				"invalid_password_length",
				"Password supplied on stdin must be between 12 and 128 characters",
			);
		}
	}
	if (input.endsWith("\r\n")) input = input.slice(0, -2);
	else if (input.endsWith("\n")) input = input.slice(0, -1);
	validateCustomerAccountPassword(input);
	return input;
}

function fingerprint(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function assertOneMutation(rows: unknown[], code: string, message: string): void {
	if (rows.length !== 1) throw new CustomerAccountOpsError(code, message);
}

async function loadExistingCustomerAccount(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	email: string,
): Promise<ExistingCustomerAccount | null> {
	const matchingUsers = await tx
		.select({
			userId: user.id,
			email: user.email,
			name: user.name,
			emailVerified: user.emailVerified,
			globalRole: user.role,
			hasReportGeneratorAccess: user.hasReportGeneratorAccess,
			banned: user.banned,
		})
		.from(user)
		.where(sql`lower(${user.email}) = ${email}`)
		.limit(2)
		.for("update");
	if (matchingUsers.length > 1) {
		throw new CustomerAccountOpsError("user_ambiguous", "Multiple users matched the supplied email case-insensitively");
	}
	const selected = matchingUsers[0];
	if (!selected) return null;

	const [memberships, accounts, sessions] = await Promise.all([
		tx
			.select({ id: member.id, organizationId: member.organizationId, role: member.role })
			.from(member)
			.where(eq(member.userId, selected.userId))
			.for("update"),
		tx
			.select({
				id: account.id,
				providerId: account.providerId,
				userId: account.userId,
				accountId: account.accountId,
				passwordPresent: sql<boolean>`${account.password} IS NOT NULL`,
			})
			.from(account)
			.where(or(eq(account.userId, selected.userId), eq(account.accountId, selected.userId)))
			.for("update"),
		tx.select({ id: session.id }).from(session).where(eq(session.userId, selected.userId)).for("update"),
	]);

	return {
		...selected,
		memberships,
		accounts,
		sessionCount: sessions.length,
	};
}

function buildReceipt(input: {
	options: CustomerAccountCliOptions;
	status: "dry-run" | "applied";
	brand: { id: string; name: string; organizationId: string };
	userId: string | null;
	plan: ReturnType<typeof planCustomerAccount>;
	revokedSessionCount: number;
}) {
	return {
		status: input.status,
		changed: input.status === "applied" && input.plan.changesRequired,
		changesRequired: input.plan.changesRequired,
		email: input.options.email,
		brandId: input.brand.id,
		brandName: input.brand.name,
		organizationId: input.brand.organizationId,
		organizationRole: input.options.organizationRole,
		storedOrganizationRole: input.plan.storedOrganizationRoleAfter,
		globalRole: "user",
		reportGeneratorAccess: false,
		userFingerprint: input.userId ? fingerprint(input.userId) : null,
		userAction: input.plan.userAction,
		membershipAction: input.plan.membershipAction,
		credentialAction: input.plan.credentialAction,
		passwordInputRequiredOnApply: input.plan.passwordRequired,
		sessions: {
			revokeRequested: input.options.revokeSessions,
			revokePlanned: input.plan.revokeSessions,
			countBefore: input.plan.sessionCountBefore,
			revoked: input.status === "applied" ? input.revokedSessionCount : 0,
		},
	};
}

async function main() {
	if (process.env.DEPLOYMENT_MODE !== "local") {
		throw new CustomerAccountOpsError(
			"deployment_mode_forbidden",
			"Customer account operations are restricted to DEPLOYMENT_MODE=local",
		);
	}

	const options = parseCustomerAccountCliOptions(process.argv.slice(2));
	return db.transaction(async (tx) => {
		await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`yonaris:customer-account:${options.email}`}))`);

		const matchingBrands = await tx
			.select({ id: brands.id, name: brands.name, organizationId: brands.organizationId })
			.from(brands)
			.where(eq(brands.id, options.brandId))
			.limit(2)
			.for("update");
		if (matchingBrands.length !== 1) {
			throw new CustomerAccountOpsError("brand_not_found", "The selected brand does not exist");
		}
		const selectedBrand = matchingBrands[0];
		if (!selectedBrand) {
			throw new CustomerAccountOpsError("brand_changed", "The selected brand changed during the operation");
		}

		const existing = await loadExistingCustomerAccount(tx, options.email);
		const plan = planCustomerAccount(options, selectedBrand.organizationId, existing);
		if (!options.apply) {
			return buildReceipt({
				options,
				status: "dry-run",
				brand: selectedBrand,
				userId: existing?.userId ?? null,
				plan,
				revokedSessionCount: 0,
			});
		}

		let passwordHash: string | null = null;
		if (plan.passwordRequired) {
			let password = await readPasswordFromStdin();
			passwordHash = await hashPassword(password);
			password = "";
		}

		const targetUserId = existing?.userId ?? randomUUID();
		if (plan.userAction === "create") {
			const insertedUsers = await tx
				.insert(user)
				.values({
					id: targetUserId,
					email: options.email,
					name: options.name,
					emailVerified: true,
					role: "user",
					hasReportGeneratorAccess: false,
					banned: false,
				})
				.returning({ id: user.id });
			assertOneMutation(insertedUsers, "user_insert_failed", "The customer user could not be created atomically");
		} else if (plan.userAction === "update") {
			const updatedUsers = await tx
				.update(user)
				.set({
					email: options.email,
					name: options.name,
					role: "user",
					hasReportGeneratorAccess: false,
					banned: false,
					updatedAt: new Date(),
				})
				.where(eq(user.id, targetUserId))
				.returning({ id: user.id });
			assertOneMutation(updatedUsers, "user_update_failed", "The customer user could not be updated atomically");
		}

		if (plan.membershipAction === "create") {
			const insertedMemberships = await tx
				.insert(member)
				.values({
					id: randomUUID(),
					userId: targetUserId,
					organizationId: selectedBrand.organizationId,
					role: options.organizationRole,
					createdAt: new Date(),
				})
				.returning({ id: member.id });
			assertOneMutation(
				insertedMemberships,
				"membership_insert_failed",
				"The customer membership could not be created atomically",
			);
		} else if (plan.membershipAction === "update") {
			if (!plan.membershipId) {
				throw new CustomerAccountOpsError("membership_id_missing", "The customer membership could not be selected");
			}
			const updatedMemberships = await tx
				.update(member)
				.set({ role: options.organizationRole })
				.where(
					and(
						eq(member.id, plan.membershipId),
						eq(member.userId, targetUserId),
						eq(member.organizationId, selectedBrand.organizationId),
					),
				)
				.returning({ id: member.id });
			assertOneMutation(
				updatedMemberships,
				"membership_update_failed",
				"The customer membership could not be updated atomically",
			);
		}

		if (plan.credentialAction === "create") {
			if (!passwordHash) {
				throw new CustomerAccountOpsError("password_hash_missing", "Password input was not available");
			}
			const insertedCredentials = await tx
				.insert(account)
				.values({
					id: randomUUID(),
					accountId: targetUserId,
					providerId: "credential",
					userId: targetUserId,
					password: passwordHash,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning({ id: account.id });
			assertOneMutation(
				insertedCredentials,
				"credential_insert_failed",
				"The password credential could not be created atomically",
			);
		} else if (plan.credentialAction === "update") {
			if (!passwordHash || !plan.credentialId) {
				throw new CustomerAccountOpsError("password_hash_missing", "Password input was not available");
			}
			const updatedCredentials = await tx
				.update(account)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(
					and(
						eq(account.id, plan.credentialId),
						eq(account.userId, targetUserId),
						eq(account.accountId, targetUserId),
						eq(account.providerId, "credential"),
					),
				)
				.returning({ id: account.id });
			assertOneMutation(
				updatedCredentials,
				"credential_update_failed",
				"The password credential could not be updated atomically",
			);
		}

		let revokedSessionCount = 0;
		if (plan.revokeSessions) {
			const revokedSessions = await tx
				.delete(session)
				.where(eq(session.userId, targetUserId))
				.returning({ id: session.id });
			revokedSessionCount = revokedSessions.length;
		}

		const verified = await loadExistingCustomerAccount(tx, options.email);
		if (!verified || verified.userId !== targetUserId) {
			throw new CustomerAccountOpsError("user_verification_failed", "Customer account verification failed");
		}
		const verificationPlan = planCustomerAccount(
			{ ...options, resetPassword: false, revokeSessions: false },
			selectedBrand.organizationId,
			verified,
		);
		if (verificationPlan.changesRequired) {
			throw new CustomerAccountOpsError("account_verification_failed", "Customer account verification failed");
		}
		if (passwordHash) {
			const verifiedCredentials = await tx
				.select({ id: account.id, password: account.password })
				.from(account)
				.where(
					and(
						eq(account.userId, targetUserId),
						eq(account.accountId, targetUserId),
						eq(account.providerId, "credential"),
					),
				)
				.limit(2);
			if (verifiedCredentials.length !== 1 || verifiedCredentials[0]?.password !== passwordHash) {
				throw new CustomerAccountOpsError("credential_verification_failed", "Password credential verification failed");
			}
		}
		if (plan.revokeSessions && verified.sessionCount !== 0) {
			throw new CustomerAccountOpsError("session_verification_failed", "Customer sessions were not fully revoked");
		}

		return buildReceipt({
			options,
			status: "applied",
			brand: selectedBrand,
			userId: targetUserId,
			plan,
			revokedSessionCount,
		});
	});
}

main().then(
	(receipt) => {
		process.stdout.write(`${JSON.stringify(receipt)}\n`, () => process.exit(0));
	},
	(error: unknown) => {
		const output =
			error instanceof CustomerAccountOpsError
				? { status: "error", code: error.code, message: error.message }
				: {
						status: "error",
						code: "unexpected_failure",
						message: "Customer account operation failed; the transaction was rolled back",
					};
		process.stderr.write(`${JSON.stringify(output)}\n`, () => process.exit(1));
	},
);
