import type { UiLanguage } from "@workspace/config/language";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type MessageId, translate } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	params: { brand: "brand-raw-id" },
	search: {} as { scope?: string },
	loaderData: {} as Record<string, unknown>,
	brand: {
		id: "brand-raw-id",
		name: "StepFun 原名",
		website: "https://evidence.example.cn/path?q=CN",
		additionalDomains: ["docs.example.cn"],
		aliases: ["Step 原始别名"],
		updatedAt: "2026-08-27T00:00:00.000Z",
		prompts: [] as Array<Record<string, unknown>>,
		measurementScopes: [] as Array<Record<string, unknown>>,
	},
	competitors: [] as Array<{ id: string; name: string; domains: string[]; aliases: string[] }>,
	checkBrandWriteAccess: vi.fn(),
	requireAuthSession: vi.fn(),
	notFound: vi.fn(),
	redirect: vi.fn(),
	routerInvalidate: vi.fn(),
	updateBrand: vi.fn(),
	updateCompetitors: vi.fn(),
	inviteTeamMember: vi.fn(),
	cancelInvitation: vi.fn(),
	removeTeamMember: vi.fn(),
}));

function createServerFnMock() {
	const builder = {
		validator: () => builder,
		handler:
			(handler: (input: { data: Record<string, unknown> }) => unknown) =>
			(input: { data: Record<string, unknown> } = { data: {} }) =>
				handler(input),
	};
	return builder;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useLoaderData: () => (Object.keys(mocks.loaderData).length > 0 ? mocks.loaderData : mocks.brand),
		useParams: () => mocks.params,
		useSearch: () => mocks.search,
	}),
	notFound: mocks.notFound,
	redirect: mocks.redirect,
	Outlet: () => <div data-testid="settings-outlet" />,
	retainSearchParams: vi.fn(() => vi.fn()),
	useNavigate: () => vi.fn(),
	useRouter: () => ({ invalidate: mocks.routerInvalidate }),
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: createServerFnMock }));
vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@workspace/lib/db/db", () => ({
	db: {
		query: { measurementScopes: { findMany: vi.fn() } },
		select: vi.fn(),
	},
}));
vi.mock("@workspace/lib/db/measurement-scopes", () => ({
	LEGACY_SCOPE: { key: "legacy-unspecified", name: "Legacy / Unspecified" },
	ensureLegacyMeasurementScope: vi.fn(),
}));
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/brand-onboarding", () => ({ default: () => null }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: mocks.brand, isLoading: false, revalidate: vi.fn() }),
	useCompetitors: () => ({ competitors: mocks.competitors, isLoading: false }),
}));
vi.mock("@/hooks/use-citations", () => ({ citationKeys: { all: ["citations"] } }));
vi.mock("@/hooks/use-dashboard-summary", () => ({ dashboardKeys: { all: ["dashboard"] } }));
vi.mock("@/lib/auth/helpers", () => ({
	checkBrandWriteAccess: mocks.checkBrandWriteAccess,
	checkOrgAccess: vi.fn(),
	checkOrgWriteAccess: vi.fn(),
	isPlatformIdentity: vi.fn(),
	listUserOrganizations: vi.fn(),
	requireAuthSession: mocks.requireAuthSession,
	requireBrandAccess: vi.fn(),
}));
vi.mock("@/hooks/use-list-filters", () => ({ validateBrandFilterSearch: vi.fn() }));
vi.mock("@/lib/config/server", () => ({
	getDeployment: () => ({ features: { teamInvites: true } }),
}));
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/server/brands", () => ({
	updateBrandFn: mocks.updateBrand,
	updateCompetitors: mocks.updateCompetitors,
}));
vi.mock("@/server/team", () => ({
	inviteTeamMemberFn: mocks.inviteTeamMember,
	cancelInvitationFn: mocks.cancelInvitation,
	removeTeamMemberFn: mocks.removeTeamMember,
	listTeamFn: vi.fn(),
}));

import { Route as BrandLayoutRoute } from "../../$brand";
import { Route as PromptEditRoute } from "../prompts/edit";
import { Route as SettingsLayoutRoute } from "../settings";
import * as BrandSettingsModule from "./brand";
import * as CompetitorsSettingsModule from "./competitors";
import { Route as LlmsRoute } from "./llms";
import * as MembersSettingsModule from "./members";
import { Route as PromptsSettingsRoute } from "./prompts";

type Mutation<T> = (input: { data: T }) => Promise<unknown>;

type BrandSettingsViewProps = {
	brand: typeof mocks.brand;
	isSubmitting: boolean;
	fieldErrors: Partial<Record<"name" | "website" | "additionalDomains", MessageId>>;
	formError: MessageId | null;
	success: boolean;
	additionalDomains: string[];
	aliases: string[];
	onAdditionalDomainsChange: (values: string[]) => void;
	onAliasesChange: (values: string[]) => void;
	onSubmit: (formData: FormData) => Promise<void>;
};

type SubmitBrandSettingsForm = (
	formData: FormData,
	context: { brandId: string; additionalDomains: string[]; aliases: string[] },
	updateBrand: Mutation<{
		brandId: string;
		name: string;
		website: string;
		additionalDomains: string[];
		aliases: string[];
	}>,
) => Promise<
	| {
			ok: true;
			submitted: {
				brandId: string;
				name: string;
				website: string;
				additionalDomains: string[];
				aliases: string[];
			};
	  }
	| {
			ok: false;
			fieldErrors: { name?: MessageId; website?: MessageId; additionalDomains?: MessageId };
			formError?: MessageId;
	  }
>;

type SubmitCompetitorsSettingsForm = (
	brandId: string,
	competitors: Array<{ _key: string; name: string; domains: string[]; aliases: string[]; expanded: boolean }>,
	updateCompetitors: Mutation<{
		brandId: string;
		competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
	}>,
) => Promise<
	| {
			ok: true;
			submitted: {
				brandId: string;
				competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
			};
	  }
	| { ok: false; formError: MessageId }
>;

type SubmitTeamInviteForm = (
	input: { brandId: string; email: string; role: "member" | "admin" },
	invite: Mutation<{ brandId: string; email: string; role: "member" | "admin" }>,
) => Promise<
	| { ok: true; submitted: { brandId: string; email: string; role: "member" | "admin" } }
	| { ok: false; fieldErrors?: { email?: MessageId }; formError?: MessageId }
>;

type TeamErrorMessageId = (action: "invite" | "remove" | "cancel", error: unknown) => MessageId;

type TestRoute = {
	component?: React.ComponentType;
	head?: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
	loader?: (input: { params: { brand: string } }) => Promise<unknown>;
	validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
	beforeLoad?: (input: { params: { brand: string } }) => unknown;
};

function routeOptions(route: unknown): TestRoute {
	return route as TestRoute;
}

function renderRoute(route: unknown, locale: UiLanguage) {
	const Component = routeOptions(route).component;
	expect(Component).toBeTypeOf("function");
	return renderToStaticMarkup(<I18nProvider locale={locale}>{Component ? <Component /> : null}</I18nProvider>);
}

function localizedHead(route: unknown, uiLanguage: UiLanguage) {
	const head = routeOptions(route).head;
	expect(head).toBeTypeOf("function");
	return head?.({
		match: { context: { uiLanguage, clientConfig: { branding: { name: "Evidence Portal" } } } },
		matches: [{ loaderData: { brandName: "StepFun 原名" } }],
		loaderData: { brandName: "StepFun 原名" },
	});
}

function getSubmitBrandSettingsForm(): SubmitBrandSettingsForm {
	const submit = (BrandSettingsModule as unknown as { submitBrandSettingsForm?: SubmitBrandSettingsForm })
		.submitBrandSettingsForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitBrandSettingsForm;
}

function getBrandSettingsView() {
	const View = (BrandSettingsModule as unknown as { BrandSettingsView?: React.ComponentType<BrandSettingsViewProps> })
		.BrandSettingsView;
	expect(View).toBeTypeOf("function");
	return View as React.ComponentType<BrandSettingsViewProps>;
}

function getSubmitCompetitorsSettingsForm(): SubmitCompetitorsSettingsForm {
	const submit = (
		CompetitorsSettingsModule as unknown as { submitCompetitorsSettingsForm?: SubmitCompetitorsSettingsForm }
	).submitCompetitorsSettingsForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitCompetitorsSettingsForm;
}

function getSubmitTeamInviteForm(): SubmitTeamInviteForm {
	const submit = (MembersSettingsModule as unknown as { submitTeamInviteForm?: SubmitTeamInviteForm })
		.submitTeamInviteForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitTeamInviteForm;
}

function getTeamErrorMessageId(): TeamErrorMessageId {
	const messageId = (MembersSettingsModule as unknown as { teamErrorMessageId?: TeamErrorMessageId })
		.teamErrorMessageId;
	expect(messageId).toBeTypeOf("function");
	return messageId as TeamErrorMessageId;
}

describe("brand settings route localization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.params = { brand: "brand-raw-id" };
		mocks.search = {};
		mocks.loaderData = {};
		mocks.brand = {
			id: "brand-raw-id",
			name: "StepFun 原名",
			website: "https://evidence.example.cn/path?q=CN",
			additionalDomains: ["docs.example.cn"],
			aliases: ["Step 原始别名"],
			updatedAt: "2026-08-27T00:00:00.000Z",
			prompts: [],
			measurementScopes: [],
		};
		mocks.competitors = [];
		mocks.checkBrandWriteAccess.mockResolvedValue(true);
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "user-raw-id" } });
		mocks.notFound.mockImplementation(() => new Error("not found"));
		mocks.redirect.mockImplementation((value) => value);
	});

	it("renders all Chinese brand fields, descriptions, placeholders, values, tooltips, and metadata", () => {
		const markup = renderRoute(BrandSettingsModule.Route, "zh-CN");
		const metadata = JSON.stringify(localizedHead(BrandSettingsModule.Route, "zh-CN")?.meta);
		mocks.brand = { ...mocks.brand, additionalDomains: [], aliases: [] };
		const emptyTagsMarkup = renderRoute(BrandSettingsModule.Route, "zh-CN");

		expect(markup).toContain("品牌");
		expect(markup).toContain("管理品牌名称和网站");
		expect(markup).toContain("品牌名称");
		expect(markup).toContain("输入品牌名称");
		expect(markup).toContain("品牌的主要网站");
		expect(markup).toContain("其他域名");
		expect(markup).toContain("品牌别名");
		expect(emptyTagsMarkup).toContain("添加域名…");
		expect(emptyTagsMarkup).toContain("添加别名…");
		expect(markup).toContain('value="StepFun 原名"');
		expect(markup).toContain('value="https://evidence.example.cn/path?q=CN"');
		expect(markup).toContain("docs.example.cn");
		expect(markup).toContain("Step 原始别名");
		expect(markup).toContain("保存更改");
		expect(markup).not.toContain("Save Changes");
		expect(metadata).toContain("品牌设置 | StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("管理品牌名称和网站");
	});

	it("renders real controlled pending and success states while keeping domain values literal", () => {
		const BrandSettingsView = getBrandSettingsView();
		const baseProps = {
			brand: mocks.brand,
			fieldErrors: {},
			formError: null,
			additionalDomains: ["docs.example.cn"],
			aliases: ["Step 原始别名"],
			onAdditionalDomainsChange: vi.fn(),
			onAliasesChange: vi.fn(),
			onSubmit: async () => undefined,
		};
		const pending = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<BrandSettingsView {...baseProps} isSubmitting success={false} />
			</I18nProvider>,
		);
		const success = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<BrandSettingsView {...baseProps} isSubmitting={false} success />
			</I18nProvider>,
		);

		expect(pending).toContain("正在保存…");
		expect(pending).toContain('value="https://evidence.example.cn/path?q=CN"');
		expect(success).toContain('role="status"');
		expect(success).toContain("品牌详情已更新。");
		expect(success).toContain("docs.example.cn");
		expect(success).toContain("Step 原始别名");
	});

	it("localizes the parent brand metadata used while onboarding without changing the brand name", () => {
		const metadata = JSON.stringify(localizedHead(BrandLayoutRoute, "zh-CN")?.meta);

		expect(metadata).toContain("StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("追踪 StepFun 原名 的 AI 回答呈现");
		expect(metadata).not.toContain("AI answer presence tracking");
	});

	it.each(["en", "zh-CN"] as const)("submits unchanged brand names, websites, domains, and aliases in %s", async () => {
		const formData = new FormData();
		formData.set("name", "StepFun 原名");
		formData.set("website", "https://evidence.example.cn/path?q=CN");
		const updateBrand = vi.fn(async () => ({ success: true }));

		const result = await getSubmitBrandSettingsForm()(
			formData,
			{
				brandId: "brand-raw-id",
				additionalDomains: ["docs.example.cn", "shop.example.cn"],
				aliases: ["Step 原始别名", "Step-R1"],
			},
			updateBrand,
		);

		expect(result).toEqual({
			ok: true,
			submitted: {
				brandId: "brand-raw-id",
				name: "StepFun 原名",
				website: "https://evidence.example.cn/path?q=CN",
				additionalDomains: ["docs.example.cn", "shop.example.cn"],
				aliases: ["Step 原始别名", "Step-R1"],
			},
		});
		expect(updateBrand).toHaveBeenCalledWith({ data: result.ok ? result.submitted : undefined });
	});

	it("returns typed validation and bounded errors while hiding unexpected brand exceptions", async () => {
		const invalid = new FormData();
		invalid.set("name", " ");
		invalid.set("website", "not a domain");
		const valid = new FormData();
		valid.set("name", "StepFun 原名");
		valid.set("website", "evidence.example.cn");
		const submit = getSubmitBrandSettingsForm();

		const validation = await submit(
			invalid,
			{ brandId: "brand-raw-id", additionalDomains: ["bad domain"], aliases: [] },
			vi.fn(),
		);
		const bounded = await submit(valid, { brandId: "brand-raw-id", additionalDomains: [], aliases: [] }, async () => {
			throw new Error("Failed to update brand");
		});
		const generic = await submit(valid, { brandId: "brand-raw-id", additionalDomains: [], aliases: [] }, async () => {
			throw new Error("postgres connection and stack detail");
		});

		expect(validation).toEqual({
			ok: false,
			fieldErrors: {
				name: "settings.brand.validation.nameRequired",
				website: "settings.brand.validation.websiteInvalid",
				additionalDomains: "settings.brand.validation.domainInvalid",
			},
		});
		expect(bounded).toEqual({ ok: false, fieldErrors: {}, formError: "settings.brand.error.update" });
		expect(generic).toEqual({ ok: false, fieldErrors: {}, formError: "common.error.unexpected" });
	});

	it("renders the Chinese competitors page, warning, editor state, save copy, and metadata", () => {
		const markup = renderRoute(CompetitorsSettingsModule.Route, "zh-CN");
		const metadata = JSON.stringify(localizedHead(CompetitorsSettingsModule.Route, "zh-CN")?.meta);

		expect(markup).toContain("竞争对手");
		expect(markup).toContain("管理用于声誉追踪的竞争格局");
		expect(markup).toContain("注意");
		expect(markup).toContain("只会应用于未来的提示词评估");
		expect(markup).toContain("添加竞争对手");
		expect(markup).toContain("保存更改");
		expect(markup).not.toContain("Warning");
		expect(metadata).toContain("竞争对手 | StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("管理追踪的竞争对手");
	});

	it.each(["en", "zh-CN"] as const)(
		"keeps competitor names, domains, aliases, and brand identity unchanged in %s",
		async () => {
			const updateCompetitors = vi.fn(async () => ({ success: true }));
			const result = await getSubmitCompetitorsSettingsForm()(
				"brand-raw-id",
				[
					{
						_key: "competitor-key",
						name: "DeepSeek 原名",
						domains: ["deepseek.example.cn"],
						aliases: ["DS-R1"],
						expanded: true,
					},
				],
				updateCompetitors,
			);

			expect(result).toEqual({
				ok: true,
				submitted: {
					brandId: "brand-raw-id",
					competitors: [{ name: "DeepSeek 原名", domains: ["deepseek.example.cn"], aliases: ["DS-R1"] }],
				},
			});
			expect(updateCompetitors).toHaveBeenCalledWith({ data: result.ok ? result.submitted : undefined });
		},
	);

	it("rejects invalid competitor domains locally and uses the generic error for arbitrary server text", async () => {
		const submit = getSubmitCompetitorsSettingsForm();
		const invalid = await submit(
			"brand-raw-id",
			[{ _key: "competitor-key", name: "DeepSeek 原名", domains: ["bad domain"], aliases: [], expanded: true }],
			vi.fn(),
		);
		const generic = await submit(
			"brand-raw-id",
			[
				{
					_key: "competitor-key",
					name: "DeepSeek 原名",
					domains: ["deepseek.example.cn"],
					aliases: [],
					expanded: true,
				},
			],
			async () => {
				throw new Error("internal competitor row detail");
			},
		);

		expect(invalid).toEqual({ ok: false, formError: "settings.competitors.validation.domainInvalid" });
		expect(generic).toEqual({ ok: false, formError: "common.error.unexpected" });
	});

	it("renders the full Chinese prompts settings surface while retaining the Program and Prompt values", () => {
		mocks.search = { scope: "scope-raw-id" };
		mocks.brand = {
			...mocks.brand,
			prompts: [
				{
					id: "prompt-raw-id",
					scopeId: "scope-raw-id",
					value: "Which AI IDE works in 中国?",
					enabled: true,
					tags: ["Buyer-Journey"],
					systemTags: ["unbranded"],
				},
			],
			measurementScopes: [
				{
					id: "scope-raw-id",
					key: "cn-zh",
					name: "中国市场 / zh-CN",
					enabled: true,
					isDefault: true,
				},
			],
		};
		const markup = renderRoute(PromptsSettingsRoute, "zh-CN");
		const metadata = JSON.stringify(localizedHead(PromptsSettingsRoute, "zh-CN")?.meta);

		expect(markup).toContain("提示词 - 中国市场 / zh-CN");
		expect(markup).toContain("为此测量范围添加、编辑或移除提示词");
		expect(markup).toContain("Which AI IDE works in 中国?");
		expect(markup).toContain("保存提示词");
		expect(markup).not.toContain("Save Prompts");
		expect(metadata).toContain("提示词 | StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("添加、编辑或移除追踪的提示词");
	});

	it("identifies the legacy Program by its canonical key rather than its mutable display name", () => {
		mocks.search = { scope: "scope-legacy-raw-id" };
		mocks.brand = {
			...mocks.brand,
			prompts: [],
			measurementScopes: [
				{
					id: "scope-legacy-raw-id",
					key: "legacy-unspecified",
					name: "Renamed legacy scope from storage",
					enabled: true,
					isDefault: true,
				},
			],
		};

		const markup = renderRoute(PromptsSettingsRoute, "zh-CN");

		expect(markup).toContain("提示词 - 旧版 / 未指定");
		expect(markup).not.toContain("Renamed legacy scope from storage");
	});

	it("renders an empty selected Program so its first prompt can be added", () => {
		mocks.search = { scope: "22222222-2222-4222-8222-222222222222" };
		mocks.brand = {
			...mocks.brand,
			measurementScopes: [
				{
					id: "22222222-2222-4222-8222-222222222222",
					key: "cn-zh",
					name: "固生堂国内监测",
					market: "CN",
					locale: "zh-CN",
					timezone: "Asia/Shanghai",
					enabled: true,
					isDefault: false,
					deliveryMode: "assisted",
					lane: "scored",
				},
			],
			prompts: [],
		};

		const markup = renderRoute(PromptsSettingsRoute, "zh-CN");

		expect(markup).toContain("提示词 - 固生堂国内监测");
		expect(markup).toContain("添加提示词");
	});

	it("renders Chinese team labels, localized role display, pending state, dates, actions, and metadata", () => {
		mocks.loaderData = {
			members: [
				{
					id: "member-raw-id",
					role: "owner",
					userId: "owner-user-id",
					name: "王小明 Original",
					email: "owner@example.cn",
					createdAt: new Date("2026-08-01T00:00:00.000Z"),
				},
			],
			invitations: [
				{
					id: "invitation-raw-id",
					email: "invitee@example.cn",
					role: "admin",
					expiresAt: new Date("2026-09-02T00:00:00.000Z"),
				},
			],
			currentUserId: "current-user-id",
		};
		const markup = renderRoute(MembersSettingsModule.Route, "zh-CN");
		const metadata = JSON.stringify(localizedHead(MembersSettingsModule.Route, "zh-CN")?.meta);

		expect(markup).toContain("团队");
		expect(markup).toContain("邀请团队成员并管理谁可以访问此品牌");
		expect(markup).toContain("邮箱");
		expect(markup).toContain("角色");
		expect(markup).toContain("邀请");
		expect(markup).toContain("成员");
		expect(markup).toContain("待处理邀请");
		expect(markup).toContain("所有者");
		expect(markup).toContain("管理员");
		expect(markup).toContain("王小明 Original");
		expect(markup).toContain("owner@example.cn");
		expect(markup).toContain("invitee@example.cn");
		expect(markup).toContain("到期日期");
		expect(markup).toContain("移除");
		expect(markup).toContain("取消");
		expect(markup).toContain('<form noValidate=""');
		expect(markup).toContain('name="email"');
		expect(markup).toContain('aria-invalid="false"');
		expect(markup).not.toContain("Pending invitations");
		expect(metadata).toContain("团队 | StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("邀请团队成员并管理团队成员");
	});

	it.each(["en", "zh-CN"] as const)("submits the exact member email and role token in %s", async () => {
		const invite = vi.fn(async () => ({ success: true }));
		const result = await getSubmitTeamInviteForm()(
			{ brandId: "brand-raw-id", email: "invitee+中国@example.cn", role: "admin" },
			invite,
		);

		expect(result).toEqual({
			ok: true,
			submitted: { brandId: "brand-raw-id", email: "invitee+中国@example.cn", role: "admin" },
		});
		expect(invite).toHaveBeenCalledWith({
			data: { brandId: "brand-raw-id", email: "invitee+中国@example.cn", role: "admin" },
		});
	});

	it("uses catalog-owned Chinese required and invalid-email validation before inviting", async () => {
		const invite = vi.fn(async () => ({ success: true }));
		const submit = getSubmitTeamInviteForm();
		const required = await submit({ brandId: "brand-raw-id", email: "  ", role: "member" }, invite);
		const invalid = await submit({ brandId: "brand-raw-id", email: "not-an-email", role: "admin" }, invite);

		expect(required).toEqual({
			ok: false,
			fieldErrors: { email: "settings.team.validation.emailRequired" },
		});
		expect(invalid).toEqual({
			ok: false,
			fieldErrors: { email: "settings.team.validation.emailInvalid" },
		});
		expect(invite).not.toHaveBeenCalled();
		if (required.ok || invalid.ok) throw new Error("Expected email validation failures");
		expect(translate("zh-CN", required.fieldErrors?.email as MessageId)).toBe("请输入邮箱地址。");
		expect(translate("zh-CN", invalid.fieldErrors?.email as MessageId)).toBe("请输入有效的邮箱地址。");
	});

	it("maps only bounded team errors and never exposes arbitrary exceptions", async () => {
		const submit = getSubmitTeamInviteForm();
		const bounded = await submit({ brandId: "brand-raw-id", email: "invitee@example.cn", role: "member" }, async () => {
			throw new Error("Team invitations are not available in this deployment");
		});
		const generic = await submit({ brandId: "brand-raw-id", email: "invitee@example.cn", role: "member" }, async () => {
			throw new Error("mail provider secret detail");
		});
		const selfRemoval = getTeamErrorMessageId()("remove", new Error("You cannot remove yourself from the team"));

		expect(bounded).toEqual({ ok: false, formError: "settings.team.error.unavailable" });
		expect(generic).toEqual({ ok: false, formError: "common.error.unexpected" });
		expect(selfRemoval).toBe("settings.team.error.selfRemove");
	});

	it("keeps settings permission predicates, the LLM fail-closed route, and Prompt redirect identities unchanged", async () => {
		const settingsLoader = routeOptions(SettingsLayoutRoute).loader;
		expect(settingsLoader).toBeTypeOf("function");

		mocks.checkBrandWriteAccess.mockResolvedValue(false);
		await expect(settingsLoader?.({ params: { brand: "brand-raw-id" } })).rejects.toThrow("not found");
		expect(mocks.checkBrandWriteAccess).toHaveBeenCalledWith("user-raw-id", "brand-raw-id");

		mocks.checkBrandWriteAccess.mockResolvedValue(true);
		await expect(settingsLoader?.({ params: { brand: "brand-raw-id" } })).resolves.toBeUndefined();

		const llmsBeforeLoad = routeOptions(LlmsRoute).beforeLoad;
		expect(() => llmsBeforeLoad?.({ params: { brand: "brand-raw-id" } })).toThrow("not found");
		expect(mocks.notFound).toHaveBeenCalled();

		const promptEditBeforeLoad = routeOptions(PromptEditRoute).beforeLoad;
		let redirectResult: unknown;
		try {
			promptEditBeforeLoad?.({ params: { brand: "brand-raw-id" } });
		} catch (error) {
			redirectResult = error;
		}
		expect(redirectResult).toEqual({
			to: "/app/$brand/settings/prompts",
			params: { brand: "brand-raw-id" },
		});
		expect(mocks.redirect).toHaveBeenCalledWith({
			to: "/app/$brand/settings/prompts",
			params: { brand: "brand-raw-id" },
		});
	});
});
