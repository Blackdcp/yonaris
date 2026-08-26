import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	loaderData: {
		organizations: [] as Array<{ id: string; name: string }>,
		canCreateBrands: false,
		supportsMultiOrg: true,
		platformDestination: null,
	},
}));

function hrefFor(to: string, params?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	return href;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useLoaderData: () => mocks.loaderData,
	}),
	Link: ({ children, to, params }: { children: ReactNode; to: string; params?: Record<string, string> }) => (
		<a href={hrefFor(to, params)}>{children}</a>
	),
	redirect: vi.fn(),
	useNavigate: () => vi.fn(),
	useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));
vi.mock("@workspace/whitelabel/auth-hooks", () => ({ syncAuth0UserById: vi.fn() }));
vi.mock("@/components/full-page-card", () => ({
	default: ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
		<main>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</main>
	),
}));
vi.mock("@/lib/auth/helpers", () => ({
	isAdmin: vi.fn(),
	isPlatformIdentity: vi.fn(),
	listUserCustomerWorkspaces: vi.fn(),
	requireAuthSession: vi.fn(),
}));
vi.mock("@/lib/config/server", () => ({ getDeployment: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/server/brands", () => ({ createBrandWithOrgFn: vi.fn() }));

import { Route as CustomerEntryRoute } from "./index";
import * as NewCustomerModule from "./new";

const NewCustomerRoute = NewCustomerModule.Route;

type SubmitNewBrandForm = (
	formData: FormData,
	createBrand: (input: { data: { brandName: string; website: string } }) => Promise<{ brandId: string }>,
) => Promise<
	| {
			ok: true;
			brandId: string;
			submitted: { brandName: string; website: string };
	  }
	| {
			ok: false;
			fieldErrors: Partial<Record<"brandName" | "website", MessageId>>;
			formError?: MessageId;
	  }
>;

function getSubmitNewBrandForm(): SubmitNewBrandForm {
	const submit = (NewCustomerModule as unknown as { submitNewBrandForm?: SubmitNewBrandForm }).submitNewBrandForm;
	expect(submit).toBeTypeOf("function");
	return submit as SubmitNewBrandForm;
}

type TestRoute = {
	component: React.ComponentType;
	head?: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
};

function routeOptions(route: unknown): TestRoute {
	return route as TestRoute;
}

function renderRoute(route: unknown, locale: UiLanguage) {
	const Component = routeOptions(route).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function localizedHead(route: unknown, uiLanguage: UiLanguage) {
	const head = routeOptions(route).head;
	expect(head).toBeTypeOf("function");
	return head?.({
		match: { context: { uiLanguage, clientConfig: { branding: { name: "Evidence Portal" } } } },
		matches: [],
	});
}

describe("customer entry localization", () => {
	beforeEach(() => {
		mocks.loaderData = {
			organizations: [],
			canCreateBrands: false,
			supportsMultiOrg: true,
			platformDestination: null,
		};
	});

	it("renders assigned customer workspaces in Chinese without changing brand names or hrefs", () => {
		mocks.loaderData.organizations = [{ id: "brand-raw-id", name: "StepFun 原名" }];
		const markup = renderRoute(CustomerEntryRoute, "zh-CN");

		expect(markup).toContain("客户工作区");
		expect(markup).toContain("选择已分配的客户工作区");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain('href="/app/brand-raw-id"');
		expect(markup).not.toContain("Customer workspaces");
	});

	it("renders the empty workspace state and create form in Chinese", () => {
		const emptyMarkup = renderRoute(CustomerEntryRoute, "zh-CN");
		const formMarkup = renderRoute(NewCustomerRoute, "zh-CN");

		expect(emptyMarkup).toContain("没有可用品牌");
		expect(formMarkup).toContain("创建客户工作区");
		expect(formMarkup).toContain("品牌名称");
		expect(formMarkup).toContain("网站");
		expect(formMarkup).toContain("创建品牌");
		expect(formMarkup).toContain('placeholder="Acme"');
		expect(formMarkup).toContain('placeholder="example.com"');
		expect(formMarkup).toContain('noValidate=""');
		expect(formMarkup).not.toContain("Create a customer workspace");
	});

	it("submits invalid Chinese forms through catalog-controlled field validation", async () => {
		const formData = new FormData();
		formData.set("brandName", "   ");
		formData.set("website", "not a domain");
		const createBrand = vi.fn(async () => ({ brandId: "must-not-run" }));

		const result = await getSubmitNewBrandForm()(formData, createBrand);

		expect(result).toEqual({
			ok: false,
			fieldErrors: {
				brandName: "customer.new.validation.brandRequired",
				website: "customer.new.validation.websiteInvalid",
			},
		});
		if (result.ok) throw new Error("Expected validation failure");
		expect(translate("zh-CN", result.fieldErrors.brandName as MessageId)).toBe("请输入品牌名称。");
		expect(translate("zh-CN", result.fieldErrors.website as MessageId)).toBe("请输入有效的网站网址或域名。");
		expect(createBrand).not.toHaveBeenCalled();
	});

	it("maps a bounded server rejection and an unexpected failure to stable localized outcomes", async () => {
		const formData = new FormData();
		formData.set("brandName", "StepFun 原名");
		formData.set("website", "evidence.example.cn");
		const submit = getSubmitNewBrandForm();

		const bounded = await submit(formData, async () => {
			throw new Error("BRAND_CREATION_NOT_ALLOWED");
		});
		const generic = await submit(formData, async () => {
			throw new Error("backend detail must stay hidden");
		});

		expect(bounded).toEqual({
			ok: false,
			fieldErrors: {},
			formError: "customer.new.error.notAllowed",
		});
		expect(generic).toEqual({
			ok: false,
			fieldErrors: {},
			formError: "common.error.unexpected",
		});
		if (bounded.ok || generic.ok) throw new Error("Expected server failures");
		expect(translate("zh-CN", bounded.formError as MessageId)).toBe("当前部署不允许创建品牌。");
		expect(translate("zh-CN", generic.formError as MessageId)).not.toContain("backend detail");
	});

	it("passes valid submitted names and domain values to the server unchanged", async () => {
		const formData = new FormData();
		formData.set("brandName", "StepFun 原名");
		formData.set("website", "evidence.example.cn/path?q=CN");
		const createBrand = vi.fn(async () => ({ brandId: "brand-created-id" }));

		const result = await getSubmitNewBrandForm()(formData, createBrand);

		expect(result).toEqual({
			ok: true,
			brandId: "brand-created-id",
			submitted: { brandName: "StepFun 原名", website: "evidence.example.cn/path?q=CN" },
		});
		expect(createBrand).toHaveBeenCalledWith({
			data: { brandName: "StepFun 原名", website: "evidence.example.cn/path?q=CN" },
		});
	});

	it("localizes customer entry metadata from the explicit route-context language", () => {
		const entryHead = localizedHead(CustomerEntryRoute, "zh-CN");
		const newHead = localizedHead(NewCustomerRoute, "zh-CN");
		const entryMeta = JSON.stringify(entryHead?.meta);
		const newMeta = JSON.stringify(newHead?.meta);

		expect(entryMeta).toContain("客户工作区 · Evidence Portal");
		expect(entryMeta).toContain("选择已分配的客户工作区");
		expect(newMeta).toContain("创建客户工作区 · Evidence Portal");
		expect(newMeta).toContain("设置一个组织和一个品牌");
	});
});
