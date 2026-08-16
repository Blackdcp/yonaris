import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	isAdmin: vi.fn(),
	hasReportAccess: vi.fn(),
	resolveAuthSession: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: (...args: never[]) => unknown) => handler,
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		useRouteContext: vi.fn(() => ({ isAdmin: false, hasReportAccess: false })),
	}),
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
	notFound: () => new Error("not-found"),
	Outlet: () => <div>Outlet</div>,
	useRouteContext: () => ({ clientConfig: { features: { reportGeneration: true, teamInvites: true } } }),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
	Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
	SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	SidebarInset: ({ children }: { children: ReactNode }) => <main>{children}</main>,
	SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	useSidebar: () => ({ setOpenMobile: vi.fn() }),
}));

vi.mock("@/components/logo", () => ({ Logo: () => <span>Yonaris</span> }));
vi.mock("@/components/nav-main", () => ({
	NavMain: ({ groups }: { groups: { label: string; items: { title: string }[] }[] }) => (
		<nav>
			{groups.map((group) => (
				<section key={group.label}>
					<h2>{group.label}</h2>
					{group.items.map((item) => (
						<span key={item.title}>{item.title}</span>
					))}
				</section>
			))}
		</nav>
	),
}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header>Header</header> }));
vi.mock("@/lib/auth/helpers", () => ({
	requireAuthSession: mocks.requireAuthSession,
	isAdmin: mocks.isAdmin,
	hasReportAccess: mocks.hasReportAccess,
}));
vi.mock("@/lib/auth/resolve-session", () => ({ resolveAuthSession: mocks.resolveAuthSession }));

import { AppSidebar } from "@/components/app-sidebar";
import { type CustomerProgramAccessStore, resolveCustomerProgramAccess } from "@/lib/auth/program-access";
import { evaluateCustomerProgramProvisionAccess } from "@/lib/auth/program-policies";
import { Route as AdminRoute } from "@/routes/_authed/admin";
import { Route as CustomerLlmsRoute } from "@/routes/_authed/app/$brand/settings/llms";
import { requireSamplingEvidenceAdmin } from "@/server/sampling-evidence";

const onboardedBrand = { id: "stepfun", name: "StepFun", onboarded: true };

describe("fixed customer and platform workspaces", () => {
	it("keeps a platform administrator in the fixed customer shell when viewing a customer workspace", () => {
		const markup = renderToStaticMarkup(<AppSidebar isAdmin hasReportAccess canManageBrand brand={onboardedBrand} />);

		expect(markup).toContain("Dashboard");
		expect(markup).toContain("Programs");
		expect(markup).toContain("Settings");
		expect(markup).not.toContain("Platform administration");
		expect(markup).not.toContain("Sampling");
		expect(markup).not.toContain("Run now");
		expect(markup).not.toContain("Local devices");
		expect(markup).not.toContain("Workflows");
		expect(markup).not.toContain("Tools");
	});

	it("keeps customer navigation out of the fixed platform shell", () => {
		const markup = renderToStaticMarkup(<AppSidebar isAdmin hasReportAccess adminOnly brand={onboardedBrand} />);

		expect(markup).toContain("Platform administration");
		expect(markup).toContain("Sampling operations");
		expect(markup).toContain("Automation");
		expect(markup).toContain("Provider tools");
		expect(markup).not.toContain("Dashboard");
		expect(markup).not.toContain("Programs");
		expect(markup).not.toContain("Settings");
	});
});

describe("platform route boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-user", role: "user" } });
		mocks.hasReportAccess.mockReturnValue(false);
	});

	it("returns not-found when a customer account directly requests /admin", async () => {
		mocks.isAdmin.mockReturnValue(false);

		await expect((AdminRoute as unknown as { beforeLoad: () => Promise<unknown> }).beforeLoad()).rejects.toThrow(
			"not-found",
		);
	});

	it("allows the same fixed /admin shell for a platform administrator", async () => {
		mocks.isAdmin.mockReturnValue(true);

		await expect((AdminRoute as unknown as { beforeLoad: () => Promise<unknown> }).beforeLoad()).resolves.toEqual({
			isAdmin: true,
			hasReportAccess: false,
		});
	});

	it("fails closed for the legacy customer LLM provider-detail URL", () => {
		expect(() => (CustomerLlmsRoute as unknown as { beforeLoad: () => unknown }).beforeLoad()).toThrow("not-found");
	});
});

describe("customer tenant and program boundary", () => {
	const brands = new Map([
		["stepfun", { id: "stepfun", name: "StepFun", organizationId: "stepfun-org" }],
		["memtensor", { id: "memtensor", name: "MemTensor", organizationId: "memtensor-org" }],
	]);
	const membership = new Map([["stepfun-user:stepfun-org", ["owner"]]]);
	const store: CustomerProgramAccessStore = {
		findBrand: vi.fn(async (brandId) => brands.get(brandId) ?? null),
		listMembershipRoles: vi.fn(async (userId, organizationId) => membership.get(`${userId}:${organizationId}`) ?? []),
	};

	it("does not let a StepFun member read MemTensor through a changed brand id", async () => {
		await expect(
			resolveCustomerProgramAccess({ userId: "stepfun-user", brandId: "stepfun" }, store),
		).resolves.toMatchObject({
			brand: { id: "stepfun", organizationId: "stepfun-org" },
		});
		await expect(resolveCustomerProgramAccess({ userId: "stepfun-user", brandId: "memtensor" }, store)).rejects.toThrow(
			"Not Found: Brand is not accessible",
		);
	});

	it.each([
		["owner", "allow"],
		["admin", "allow"],
		["member", "deny"],
		["viewer", "deny"],
		[undefined, "deny"],
	] as const)("gives the Programs create permission for %s only when policy returns %s", (role, expected) => {
		expect(evaluateCustomerProgramProvisionAccess(role)).toBe(expected);
	});
});

describe("platform-only collection execution", () => {
	beforeEach(() => vi.clearAllMocks());

	it("rejects a signed-in customer account at the sampling evidence server boundary", async () => {
		mocks.resolveAuthSession.mockResolvedValue({ user: { id: "stepfun-user", role: "user" } });
		mocks.isAdmin.mockReturnValue(false);

		await expect(requireSamplingEvidenceAdmin(new Request("https://portal.example.test"))).rejects.toMatchObject({
			status: 403,
			message: "Administrator access required",
		});
	});

	it("allows a platform administrator at the sampling evidence server boundary", async () => {
		const session = { user: { id: "platform-admin", role: "admin" } };
		mocks.resolveAuthSession.mockResolvedValue(session);
		mocks.isAdmin.mockReturnValue(true);

		await expect(requireSamplingEvidenceAdmin(new Request("https://portal.example.test"))).resolves.toBe(session);
	});

	it.each([
		["sampling", new URL("../../server/sampling.ts", import.meta.url), "requireSamplingAdmin"],
		["platform automation", new URL("../../server/admin.ts", import.meta.url), "requireAdmin"],
	] as const)("keeps every exported %s server function behind its platform guard", (_label, sourceUrl, guardName) => {
		const source = readFileSync(sourceUrl, "utf8");
		const exportedFunctions = [...source.matchAll(/^export const (\w+Fn)\s*=\s*createServerFn/gm)];

		expect(exportedFunctions.length).toBeGreaterThan(0);
		for (const [index, match] of exportedFunctions.entries()) {
			const start = match.index ?? 0;
			const end = exportedFunctions[index + 1]?.index ?? source.length;
			const implementation = source.slice(start, end);
			expect(implementation, `${match[1]} must call ${guardName}`).toMatch(
				new RegExp(`await\\s+${guardName}(?:Brand)?\\(`),
			);
		}
	});
});
