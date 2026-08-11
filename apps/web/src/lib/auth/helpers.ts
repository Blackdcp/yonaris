/**
 * Server-side auth helpers backed by better-auth.
 */
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "@workspace/lib/db/db";
import { member, organization } from "@workspace/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getDeployment } from "@/lib/config/server";
import { evaluateOrgWriteAccess } from "./policies";
import { resolveAuthSession } from "./resolve-session";

type SessionLike = { user: { id: string; [key: string]: unknown }; session?: unknown };

export async function getAuthSession() {
	const headers = getRequestHeaders();
	return resolveAuthSession(headers);
}

export async function requireAuthSession() {
	const session = await getAuthSession();
	if (!session) throw new Error("Unauthorized: Authentication required");
	return session;
}

export function isAdmin(session: SessionLike): boolean {
	return session.user.role === "admin";
}

export function hasReportAccess(session: SessionLike): boolean {
	// Report generation is disabled entirely in deployments that don't support
	// it (cloud), so the per-user flag is ignored there.
	if (!getDeployment().features.reportGeneration) return false;
	return session.user.hasReportGeneratorAccess === true;
}

export async function checkOrgAccess(userId: string, orgId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: member.id })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
		.limit(1);
	return !!row;
}

export async function requireOrgAccess(userId: string, orgId: string): Promise<void> {
	if (!(await checkOrgAccess(userId, orgId))) {
		throw new Error("Forbidden: No access to this organization");
	}
}

export async function getOrgMembershipRole(userId: string, orgId: string): Promise<string | null> {
	const [row] = await db
		.select({ role: member.role })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
		.limit(1);
	return row?.role ?? null;
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
