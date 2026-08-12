import { randomBytes, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "@workspace/lib/auth/password";
import { db } from "@workspace/lib/db/db";
import { account, brands, member, session, user } from "@workspace/lib/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";

const customerRoleSchema = z.enum(["owner", "admin", "analyst", "viewer"]);
export type CustomerWorkspaceRole = z.infer<typeof customerRoleSchema>;

function requirePlatformAdministrator(sessionValue: Awaited<ReturnType<typeof requireAuthSession>>): void {
	if (!isAdmin(sessionValue)) throw new Error("Forbidden: Platform administrator access required");
}

function publicRole(storedRole: string): CustomerWorkspaceRole | "legacy-member" | "unknown" {
	if (storedRole === "member") return "analyst";
	if (customerRoleSchema.safeParse(storedRole).success) return storedRole as CustomerWorkspaceRole;
	return storedRole === "" ? "unknown" : "legacy-member";
}

function generateTemporaryPassword(): string {
	return `${randomBytes(18).toString("base64url")}Aa7!`;
}

export const listCustomerWorkspacesFn = createServerFn({ method: "GET" }).handler(async () => {
	const authSession = await requireAuthSession();
	requirePlatformAdministrator(authSession);
	const rows = await db
		.select({ id: brands.id, name: brands.name, enabled: brands.enabled, organizationId: brands.organizationId })
		.from(brands)
		.orderBy(brands.name, brands.id);
	const organizationCounts = new Map<string, number>();
	for (const row of rows) {
		organizationCounts.set(row.organizationId, (organizationCounts.get(row.organizationId) ?? 0) + 1);
	}
	return rows
		.filter((row) => organizationCounts.get(row.organizationId) === 1)
		.map(({ id, name, enabled }) => ({ id, name, enabled }));
});

async function lockBrand(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], brandId: string) {
	const [candidate] = await tx
		.select({ id: brands.id, name: brands.name, organizationId: brands.organizationId })
		.from(brands)
		.where(eq(brands.id, brandId))
		.limit(1);
	if (!candidate) throw new Error("Not Found: Customer workspace does not exist");
	const rows = await tx
		.select({ id: brands.id, name: brands.name, organizationId: brands.organizationId })
		.from(brands)
		.where(eq(brands.organizationId, candidate.organizationId))
		.orderBy(asc(brands.id))
		.limit(2)
		.for("update");
	if (rows.length !== 1 || rows[0]?.id !== brandId) {
		throw new Error("Customer access requires exactly one brand in the selected organization");
	}
	return rows[0];
}

export const listCustomerAccessFn = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string().min(1) }))
	.handler(async ({ data }) => {
		const authSession = await requireAuthSession();
		requirePlatformAdministrator(authSession);

		const brand = await db.query.brands.findFirst({
			where: eq(brands.id, data.brandId),
			columns: { id: true, name: true, organizationId: true },
		});
		if (!brand) throw new Error("Not Found: Customer workspace does not exist");
		const workspaceBrands = await db
			.select({ id: brands.id })
			.from(brands)
			.where(eq(brands.organizationId, brand.organizationId))
			.orderBy(asc(brands.id))
			.limit(2);
		if (workspaceBrands.length !== 1 || workspaceBrands[0]?.id !== brand.id) {
			throw new Error("Customer access requires exactly one brand in the selected organization");
		}

		const rows = await db
			.select({
				membershipId: member.id,
				userId: user.id,
				name: user.name,
				email: user.email,
				globalRole: user.role,
				emailVerified: user.emailVerified,
				hasReportGeneratorAccess: user.hasReportGeneratorAccess,
				banned: user.banned,
				organizationRole: member.role,
				createdAt: member.createdAt,
			})
			.from(member)
			.innerJoin(user, eq(member.userId, user.id))
			.where(eq(member.organizationId, brand.organizationId))
			.orderBy(user.email, member.id);
		const userIds = [...new Set(rows.map((row) => row.userId))];
		const [allMemberships, allAccounts] =
			userIds.length === 0
				? [[], []]
				: await Promise.all([
						db
							.select({ userId: member.userId, organizationId: member.organizationId })
							.from(member)
							.where(inArray(member.userId, userIds)),
						db
							.select({
								userId: account.userId,
								accountId: account.accountId,
								providerId: account.providerId,
								passwordPresent: sql<boolean>`${account.password} IS NOT NULL`,
							})
							.from(account)
							.where(inArray(account.userId, userIds)),
					]);

		return {
			brand: { id: brand.id, name: brand.name },
			accounts: rows.map((row) => ({
				...(() => {
					const memberships = allMemberships.filter((entry) => entry.userId === row.userId);
					const accounts = allAccounts.filter((entry) => entry.userId === row.userId);
					const singleInternalCredential =
						accounts.length === 1 &&
						accounts[0]?.providerId === "credential" &&
						accounts[0]?.accountId === row.userId &&
						accounts[0]?.passwordPresent === true;
					return {
						isCustomerAccount:
							memberships.length === 1 &&
							memberships[0]?.organizationId === brand.organizationId &&
							singleInternalCredential &&
							(row.globalRole === null || row.globalRole === "user") &&
							row.hasReportGeneratorAccess !== true &&
							row.banned !== true &&
							row.emailVerified === true,
					};
				})(),
				membershipId: row.membershipId,
				userId: row.userId,
				name: row.name,
				email: row.email,
				workspaceRole: publicRole(row.organizationRole),
				createdAt: row.createdAt.toISOString(),
			})),
		};
	});

export const createCustomerAccessFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string().min(1),
			name: z.string().trim().min(1).max(200),
			email: z.string().trim().toLowerCase().email().max(320),
			workspaceRole: customerRoleSchema,
		}),
	)
	.handler(async ({ data }) => {
		const authSession = await requireAuthSession();
		requirePlatformAdministrator(authSession);

		const temporaryPassword = generateTemporaryPassword();
		const passwordHash = await hashPassword(temporaryPassword);
		const created = await db.transaction(async (tx) => {
			await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
			await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`yonaris:customer-access:${data.email}`}))`);
			const brand = await lockBrand(tx, data.brandId);

			const matchingUsers = await tx
				.select({ id: user.id })
				.from(user)
				.where(sql`lower(${user.email}) = ${data.email}`)
				.limit(2)
				.for("update");
			if (matchingUsers.length > 0) {
				throw new Error("Account already exists; use password reset or the internal account operation for changes");
			}

			const userId = randomUUID();
			await tx.insert(user).values({
				id: userId,
				name: data.name,
				email: data.email,
				emailVerified: true,
				role: "user",
				hasReportGeneratorAccess: false,
				banned: false,
			});
			await tx.insert(account).values({
				id: randomUUID(),
				accountId: userId,
				providerId: "credential",
				userId,
				password: passwordHash,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			await tx.insert(member).values({
				id: randomUUID(),
				organizationId: brand.organizationId,
				userId,
				role: data.workspaceRole,
				createdAt: new Date(),
			});

			return { userId, brandName: brand.name };
		});

		return {
			status: "created" as const,
			brandId: data.brandId,
			brandName: created.brandName,
			userId: created.userId,
			name: data.name,
			email: data.email,
			workspaceRole: data.workspaceRole,
			temporaryPassword,
			passwordShownOnce: true as const,
		};
	});

export const resetCustomerAccessPasswordFn = createServerFn({ method: "POST" })
	.validator(z.object({ brandId: z.string().min(1), userId: z.string().min(1) }))
	.handler(async ({ data }) => {
		const authSession = await requireAuthSession();
		requirePlatformAdministrator(authSession);

		const temporaryPassword = generateTemporaryPassword();
		const passwordHash = await hashPassword(temporaryPassword);
		const result = await db.transaction(async (tx) => {
			await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
			const brand = await lockBrand(tx, data.brandId);
			const rows = await tx
				.select({
					email: user.email,
					globalRole: user.role,
					reportAccess: user.hasReportGeneratorAccess,
					banned: user.banned,
				})
				.from(member)
				.innerJoin(user, eq(member.userId, user.id))
				.where(and(eq(member.organizationId, brand.organizationId), eq(member.userId, data.userId)))
				.limit(2)
				.for("update");
			if (rows.length !== 1 || !rows[0]) throw new Error("Not Found: Customer account does not exist");
			if (
				(rows[0].globalRole !== null && rows[0].globalRole !== "user") ||
				rows[0].reportAccess === true ||
				rows[0].banned === true
			) {
				throw new Error("Forbidden: Platform identities cannot be modified from customer access");
			}
			const memberships = await tx
				.select({ id: member.id, organizationId: member.organizationId })
				.from(member)
				.where(eq(member.userId, data.userId))
				.orderBy(asc(member.id))
				.limit(2)
				.for("update");
			if (memberships.length !== 1 || memberships[0]?.organizationId !== brand.organizationId) {
				throw new Error("Customer account must belong to exactly one customer workspace");
			}

			const credentials = await tx
				.select({ id: account.id, accountId: account.accountId, providerId: account.providerId })
				.from(account)
				.where(eq(account.userId, data.userId))
				.limit(2)
				.for("update");
			if (
				credentials.length !== 1 ||
				credentials[0]?.accountId !== data.userId ||
				credentials[0]?.providerId !== "credential"
			) {
				throw new Error("Customer account does not have one internal password credential");
			}
			await tx
				.update(account)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(eq(account.id, credentials[0].id));
			await tx.delete(session).where(eq(session.userId, data.userId));
			return { email: rows[0].email, brandName: brand.name };
		});

		return {
			status: "password-reset" as const,
			brandId: data.brandId,
			brandName: result.brandName,
			userId: data.userId,
			email: result.email,
			temporaryPassword,
			passwordShownOnce: true as const,
		};
	});
