/**
 * Server-side auth helpers backed by better-auth.
 */
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "@workspace/lib/db/db";
import { brands, member, organization, user } from "@workspace/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getDeployment } from "@/lib/config/server";
import { evaluateOrgAdminAccess, evaluateOrgWriteAccess } from "./policies";
import { resolveAuthSession } from "./resolve-session";

type SessionLike = { user: { id: string; [key: string]: unknown }; session?: unknown };

export function hasRoleToken(value: unknown, expected: string): boolean {
	const roles = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
	return roles.some((role) => typeof role === "string" && role.trim() === expected);
}

export async function getAuthSession() {
	const headers = getRequestHeaders();
	return resolveAuthSession(headers);
}

export async function requireAuthSession() {
	const session = await getAuthSession();
	if (!session) throw new Error("Unauthorized: Authentication required");
	assertNonImpersonatedSession(session);
	return session;
}

export function isAdmin(session: SessionLike): boolean {
	return hasRoleToken(session.user.role, "admin");
}

export function isImpersonatedSession(session: SessionLike): boolean {
	const authSession = session.session as { impersonatedBy?: unknown } | undefined;
	return Boolean(authSession?.impersonatedBy);
}

export function assertNonImpersonatedSession(session: SessionLike): void {
	if (isImpersonatedSession(session)) {
		throw new Error("Forbidden: Impersonated sessions are not supported");
	}
}

/** Identity classification is independent from whether a platform feature is enabled. */
export function isPlatformIdentity(session: SessionLike): boolean {
	return isAdmin(session) || session.user.hasReportGeneratorAccess === true || isImpersonatedSession(session);
}

export function hasReportAccess(session: SessionLike): boolean {
	// Report generation is disabled entirely in deployments that don't support
	// it (cloud), so the per-user flag is ignored there.
	if (!getDeployment().features.reportGeneration) return false;
	return session.user.hasReportGeneratorAccess === true;
}

export async function checkOrgAccess(userId: string, orgId: string): Promise<boolean> {
	const rows = await db
		.select({ id: member.id })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
		.limit(2);
	return rows.length === 1;
}

export async function requireOrgAccess(userId: string, orgId: string): Promise<void> {
	if (!(await checkOrgAccess(userId, orgId))) {
		throw new Error("Forbidden: No access to this organization");
	}
}

export async function getOrgMembershipRole(userId: string, orgId: string): Promise<string | null> {
	const rows = await db
		.select({ role: member.role })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
		.limit(2);
	return rows.length === 1 ? (rows[0]?.role ?? null) : null;
}

export async function checkOrgWriteAccess(userId: string, orgId: string): Promise<boolean> {
	const role = await getOrgMembershipRole(userId, orgId);
	return evaluateOrgWriteAccess(role) === "allow";
}

export async function requireOrgWriteAccess(userId: string, orgId: string): Promise<void> {
	if (!(await checkOrgWriteAccess(userId, orgId))) {
		throw new Error("Forbidden: This account has read-only access to this organization");
	}
}

export interface BrandAccessContext {
	brandId: string;
	organizationId: string;
	membershipRole: string;
}

/**
 * Resolve a customer-facing brand through its owning organization.
 *
 * A brand id is a product resource id, not an authorization boundary. Older
 * local installations happened to use the same value for both, but cloud and
 * imported tenants do not have to. Keep this as the single entry point for
 * customer brand authorization so a caller can never accidentally authorize
 * against an unrelated organization whose id happens to equal a brand id.
 * Duplicate memberships fail closed instead of choosing an arbitrary role.
 */
export async function resolveBrandAccess(userId: string, brandId: string): Promise<BrandAccessContext | null> {
	const [[brand], identities] = await Promise.all([
		db
			.select({ id: brands.id, organizationId: brands.organizationId })
			.from(brands)
			.where(eq(brands.id, brandId))
			.limit(1),
		db
			.select({ role: user.role, hasReportGeneratorAccess: user.hasReportGeneratorAccess })
			.from(user)
			.where(eq(user.id, userId))
			.limit(2),
	]);
	if (!brand) return null;
	if (
		identities.length !== 1 ||
		hasRoleToken(identities[0]?.role, "admin") ||
		identities[0]?.hasReportGeneratorAccess === true
	) {
		return null;
	}

	const memberships = await db
		.select({ role: member.role })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.organizationId, brand.organizationId)))
		.limit(2);
	if (memberships.length !== 1 || !memberships[0]?.role) return null;

	return {
		brandId: brand.id,
		organizationId: brand.organizationId,
		membershipRole: memberships[0].role,
	};
}

export async function checkBrandAccess(userId: string, brandId: string): Promise<boolean> {
	return (await resolveBrandAccess(userId, brandId)) !== null;
}

export async function requireBrandAccess(userId: string, brandId: string): Promise<BrandAccessContext> {
	const access = await resolveBrandAccess(userId, brandId);
	if (!access) throw new Error("Not Found: Brand is not accessible");
	return access;
}

export async function checkBrandWriteAccess(userId: string, brandId: string): Promise<boolean> {
	const access = await resolveBrandAccess(userId, brandId);
	return access !== null && evaluateOrgWriteAccess(access.membershipRole) === "allow";
}

export async function requireBrandWriteAccess(userId: string, brandId: string): Promise<BrandAccessContext> {
	const access = await requireBrandAccess(userId, brandId);
	if (evaluateOrgWriteAccess(access.membershipRole) !== "allow") {
		throw new Error("Forbidden: This account has read-only access to this customer workspace");
	}
	return access;
}

export async function requireBrandAdminAccess(userId: string, brandId: string): Promise<BrandAccessContext> {
	const access = await requireBrandAccess(userId, brandId);
	if (evaluateOrgAdminAccess(access.membershipRole) !== "allow") {
		throw new Error("Forbidden: Customer workspace administrator access required");
	}
	return access;
}

export async function checkAnyOrgWriteAccess(userId: string): Promise<boolean> {
	const memberships = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId));
	return memberships.some(({ role }) => evaluateOrgWriteAccess(role) === "allow");
}

export async function listUserOrganizations(userId: string): Promise<{ id: string; name: string }[]> {
	return db
		.select({ id: organization.id, name: organization.name })
		.from(member)
		.innerJoin(organization, eq(member.organizationId, organization.id))
		.where(eq(member.userId, userId));
}

export interface CustomerWorkspaceLink {
	id: string;
	name: string;
	organizationId: string;
	needsOnboarding: boolean;
}

type CustomerWorkspaceRow = {
	membershipId: string;
	organizationId: string;
	organizationName: string;
	brandId: string | null;
	brandName: string | null;
};

export function buildCustomerWorkspaceLinks(rows: CustomerWorkspaceRow[]): CustomerWorkspaceLink[] {
	const byOrganization = new Map<string, CustomerWorkspaceRow[]>();
	for (const row of rows) {
		const group = byOrganization.get(row.organizationId) ?? [];
		group.push(row);
		byOrganization.set(row.organizationId, group);
	}

	const workspaces: CustomerWorkspaceLink[] = [];
	for (const [organizationId, group] of byOrganization) {
		const membershipIds = new Set(group.map((row) => row.membershipId));
		const brandRows = group.filter((row): row is CustomerWorkspaceRow & { brandId: string } => row.brandId !== null);
		const brandIds = new Set(brandRows.map((row) => row.brandId));
		if (membershipIds.size !== 1 || brandIds.size > 1) {
			throw new Error("Customer workspace membership is ambiguous");
		}

		const first = group[0];
		if (!first) continue;
		const brand = brandRows[0];
		workspaces.push({
			id: brand?.brandId ?? organizationId,
			name: brand?.brandName ?? first.organizationName,
			organizationId,
			needsOnboarding: !brand,
		});
	}

	return workspaces;
}

/**
 * List customer navigation targets using the brand resource id, never the
 * authorization organization id. An organization without a brand retains its
 * organization id only as the explicit pre-brand onboarding target.
 * Duplicate memberships or multiple brands fail closed.
 */
export async function listUserCustomerWorkspaces(userId: string): Promise<CustomerWorkspaceLink[]> {
	const rows = await db
		.select({
			membershipId: member.id,
			organizationId: organization.id,
			organizationName: organization.name,
			brandId: brands.id,
			brandName: brands.name,
		})
		.from(member)
		.innerJoin(organization, eq(member.organizationId, organization.id))
		.leftJoin(brands, eq(brands.organizationId, organization.id))
		.where(eq(member.userId, userId))
		.orderBy(asc(organization.name), asc(organization.id), asc(brands.id));

	return buildCustomerWorkspaceLinks(rows);
}
