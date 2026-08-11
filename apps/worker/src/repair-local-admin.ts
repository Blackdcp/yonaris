import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "@workspace/lib/auth/password";
import { db } from "@workspace/lib/db/db";
import { account, brands, member, organization, session, user } from "@workspace/lib/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import {
	BOOTSTRAP_ORGANIZATION_ID,
	LocalAdminRepairError,
	parseLocalAdminRepairOptions,
	planAdminMembership,
	planCredentialReset,
	selectUniqueBootstrapOwner,
	validateStdinPassword,
} from "./local-admin-repair";

async function readPasswordFromStdin(): Promise<string> {
	if (process.stdin.isTTY) {
		throw new LocalAdminRepairError(
			"password_stdin_required",
			"Password reset input must be piped or redirected through stdin",
		);
	}

	let input = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) {
		input += chunk;
		if (input.length > 130) {
			throw new LocalAdminRepairError(
				"invalid_password_length",
				"Password supplied on stdin must be between 12 and 128 characters",
			);
		}
	}

	if (input.endsWith("\r\n")) input = input.slice(0, -2);
	else if (input.endsWith("\n")) input = input.slice(0, -1);
	validateStdinPassword(input);
	return input;
}

function fingerprint(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function assertOneMutation(rows: unknown[], code: string, message: string): void {
	if (rows.length !== 1) throw new LocalAdminRepairError(code, message);
}

async function main() {
	if (process.env.DEPLOYMENT_MODE !== "local") {
		throw new LocalAdminRepairError(
			"deployment_mode_forbidden",
			"Local admin repair is restricted to DEPLOYMENT_MODE=local",
		);
	}

	const options = parseLocalAdminRepairOptions(process.argv.slice(2));
	let passwordHash: string | null = null;
	if (options.apply && options.resetPassword) {
		let password = await readPasswordFromStdin();
		passwordHash = await hashPassword(password);
		password = "";
	}

	const summary = await db.transaction(async (tx) => {
		await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
		const selectorLock =
			options.selector.type === "bootstrap-owner"
				? "bootstrap-owner"
				: `${fingerprint(options.selector.email)}:${fingerprint(options.selector.brandId)}`;
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`yonaris:local-admin-repair:${selectorLock}`}))`);

		let target: {
			userId: string;
			userRole: string | null;
			hasReportGeneratorAccess: boolean | null;
			organizationId: string;
			brandId: string | null;
			memberships: Array<{ id: string; role: string }>;
		};

		if (options.selector.type === "bootstrap-owner") {
			const defaultOrganizations = await tx
				.select({ id: organization.id })
				.from(organization)
				.where(eq(organization.id, BOOTSTRAP_ORGANIZATION_ID))
				.limit(2)
				.for("update");
			if (defaultOrganizations.length !== 1) {
				throw new LocalAdminRepairError(
					"bootstrap_organization_not_found",
					"The default organization does not exist unambiguously",
				);
			}

			const candidates = await tx
				.select({
					membershipId: member.id,
					userId: user.id,
					memberRole: member.role,
					userRole: user.role,
					hasReportGeneratorAccess: user.hasReportGeneratorAccess,
				})
				.from(member)
				.innerJoin(user, eq(user.id, member.userId))
				.where(eq(member.organizationId, BOOTSTRAP_ORGANIZATION_ID))
				.for("update");
			const selected = selectUniqueBootstrapOwner(candidates);
			target = {
				userId: selected.userId,
				userRole: selected.userRole,
				hasReportGeneratorAccess: selected.hasReportGeneratorAccess,
				organizationId: BOOTSTRAP_ORGANIZATION_ID,
				brandId: null,
				memberships: candidates
					.filter((candidate) => candidate.userId === selected.userId)
					.map((candidate) => ({ id: candidate.membershipId, role: candidate.memberRole })),
			};
		} else {
			const matchingBrands = await tx
				.select({ id: brands.id, organizationId: brands.organizationId })
				.from(brands)
				.where(eq(brands.id, options.selector.brandId))
				.limit(2)
				.for("update");
			if (matchingBrands.length !== 1) {
				throw new LocalAdminRepairError("brand_not_found", "The selected brand does not exist");
			}

			const matchingUsers = await tx
				.select({
					id: user.id,
					role: user.role,
					hasReportGeneratorAccess: user.hasReportGeneratorAccess,
				})
				.from(user)
				.where(sql`lower(${user.email}) = ${options.selector.email}`)
				.limit(2)
				.for("update");
			if (matchingUsers.length === 0) {
				throw new LocalAdminRepairError("user_not_found", "No user matched the supplied email");
			}
			if (matchingUsers.length !== 1) {
				throw new LocalAdminRepairError(
					"user_ambiguous",
					"Multiple users matched the supplied email case-insensitively",
				);
			}

			const selectedBrand = matchingBrands[0];
			const selectedUser = matchingUsers[0];
			if (!selectedBrand || !selectedUser) {
				throw new LocalAdminRepairError("selector_changed", "The selected brand or user changed during repair");
			}
			const memberships = await tx
				.select({ id: member.id, role: member.role })
				.from(member)
				.where(and(eq(member.userId, selectedUser.id), eq(member.organizationId, selectedBrand.organizationId)))
				.limit(2)
				.for("update");
			target = {
				userId: selectedUser.id,
				userRole: selectedUser.role,
				hasReportGeneratorAccess: selectedUser.hasReportGeneratorAccess,
				organizationId: selectedBrand.organizationId,
				brandId: selectedBrand.id,
				memberships,
			};
		}

		const membershipPlan = planAdminMembership(target.memberships);
		const userNeedsRepair = target.userRole !== "admin" || target.hasReportGeneratorAccess !== true;
		let credentialPlan: ReturnType<typeof planCredentialReset> | null = null;
		if (options.resetPassword) {
			const credentials = await tx
				.select({ id: account.id, userId: account.userId, accountId: account.accountId })
				.from(account)
				.where(
					and(
						eq(account.providerId, "credential"),
						or(eq(account.userId, target.userId), eq(account.accountId, target.userId)),
					),
				)
				.limit(2)
				.for("update");
			credentialPlan = planCredentialReset(credentials, target.userId);
		}

		let revokedSessionCount = 0;
		if (options.apply) {
			if (userNeedsRepair) {
				const updatedUsers = await tx
					.update(user)
					.set({ role: "admin", hasReportGeneratorAccess: true, updatedAt: new Date() })
					.where(eq(user.id, target.userId))
					.returning({ id: user.id });
				assertOneMutation(updatedUsers, "user_update_failed", "The selected user could not be repaired atomically");
			}

			if (membershipPlan.action === "create") {
				const insertedMemberships = await tx
					.insert(member)
					.values({
						id: randomUUID(),
						userId: target.userId,
						organizationId: target.organizationId,
						role: "admin",
						createdAt: new Date(),
					})
					.returning({ id: member.id });
				assertOneMutation(
					insertedMemberships,
					"membership_insert_failed",
					"The admin membership could not be created atomically",
				);
			} else if (membershipPlan.action === "promote") {
				const updatedMemberships = await tx
					.update(member)
					.set({ role: "admin" })
					.where(eq(member.id, membershipPlan.membershipId))
					.returning({ id: member.id });
				assertOneMutation(
					updatedMemberships,
					"membership_update_failed",
					"The admin membership could not be promoted atomically",
				);
			}

			if (options.resetPassword) {
				if (!passwordHash || !credentialPlan) {
					throw new LocalAdminRepairError("password_hash_missing", "Password reset input was not available");
				}
				if (credentialPlan.action === "create") {
					const insertedCredentials = await tx
						.insert(account)
						.values({
							id: randomUUID(),
							accountId: target.userId,
							providerId: "credential",
							userId: target.userId,
							password: passwordHash,
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning({ id: account.id });
					assertOneMutation(
						insertedCredentials,
						"credential_insert_failed",
						"The credential account could not be created atomically",
					);
				} else {
					const updatedCredentials = await tx
						.update(account)
						.set({ password: passwordHash, updatedAt: new Date() })
						.where(eq(account.id, credentialPlan.accountId))
						.returning({ id: account.id });
					assertOneMutation(
						updatedCredentials,
						"credential_update_failed",
						"The credential account could not be updated atomically",
					);
				}

				const revokedSessions = await tx
					.delete(session)
					.where(eq(session.userId, target.userId))
					.returning({ id: session.id });
				revokedSessionCount = revokedSessions.length;
			}

			const verifiedUsers = await tx
				.select({ role: user.role, hasReportGeneratorAccess: user.hasReportGeneratorAccess })
				.from(user)
				.where(eq(user.id, target.userId))
				.limit(2);
			if (
				verifiedUsers.length !== 1 ||
				verifiedUsers[0]?.role !== "admin" ||
				verifiedUsers[0].hasReportGeneratorAccess !== true
			) {
				throw new LocalAdminRepairError("user_verification_failed", "User repair verification failed");
			}

			const verifiedMemberships = await tx
				.select({ id: member.id, role: member.role })
				.from(member)
				.where(and(eq(member.userId, target.userId), eq(member.organizationId, target.organizationId)))
				.limit(2);
			if (planAdminMembership(verifiedMemberships).action !== "none") {
				throw new LocalAdminRepairError(
					"membership_verification_failed",
					"Admin membership repair verification failed",
				);
			}

			if (options.resetPassword) {
				const verifiedCredentials = await tx
					.select({
						id: account.id,
						userId: account.userId,
						accountId: account.accountId,
						password: account.password,
					})
					.from(account)
					.where(
						and(
							eq(account.providerId, "credential"),
							or(eq(account.userId, target.userId), eq(account.accountId, target.userId)),
						),
					)
					.limit(2);
				planCredentialReset(verifiedCredentials, target.userId);
				if (verifiedCredentials[0]?.password !== passwordHash) {
					throw new LocalAdminRepairError("credential_verification_failed", "Credential reset verification failed");
				}
			}
		}

		const changesRequired = userNeedsRepair || membershipPlan.action !== "none" || options.resetPassword;
		return {
			status: options.apply ? "applied" : "dry-run",
			selector: options.selector.type,
			targetFingerprint: fingerprint(target.userId),
			...(target.brandId ? { brandId: target.brandId } : {}),
			organizationId: target.organizationId,
			changesRequired,
			changed: options.apply && changesRequired,
			userRole: { before: target.userRole, after: "admin", changed: userNeedsRepair },
			reportGeneratorAccess: {
				before: target.hasReportGeneratorAccess === true,
				after: true,
				changed: target.hasReportGeneratorAccess !== true,
			},
			membership: {
				action: membershipPlan.action,
				before: membershipPlan.before,
				after: membershipPlan.after,
			},
			credentialAction: options.resetPassword ? credentialPlan?.action : "none",
			sessionsRevokePlanned: options.resetPassword,
			sessionsRevoked: options.apply && options.resetPassword,
			revokedSessionCount,
		};
	});

	console.log(JSON.stringify(summary));
}

main().then(
	() => process.exit(0),
	(error: unknown) => {
		if (error instanceof LocalAdminRepairError) {
			console.error(JSON.stringify({ status: "error", code: error.code, message: error.message }));
		} else {
			console.error(
				JSON.stringify({
					status: "error",
					code: "unexpected_failure",
					message: "Local admin repair failed; the transaction was rolled back",
				}),
			);
		}
		process.exit(1);
	},
);
