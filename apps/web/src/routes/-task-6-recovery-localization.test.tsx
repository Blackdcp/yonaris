import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	params: { brand: "brand-raw-id" },
	search: { redirect: "/app/brand-raw-id/prompts?scope=scope-cn#raw-fragment" },
	branding: { name: "Evidence Portal", icon: "/raw-icon.svg", wordmark: "/raw-wordmark.svg" },
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => mocks.params,
		useSearch: () => mocks.search,
	}),
	Link: ({ children, to, params }: { children: ReactNode; to: string; params?: Record<string, string> }) => {
		let href = to;
		for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
		return <a href={href}>{children}</a>;
	},
	redirect: vi.fn(),
	useRouteContext: () => ({ clientConfig: { branding: mocks.branding } }),
}));
vi.mock("@workspace/ui/components/button", () => ({
	Button: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/full-page-card", () => ({
	default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { Logo } from "@/components/logo";
import { Route as BrandNotFoundRoute } from "./_authed/app/$brand/$";
import { Route as HomeRoute } from "./index";

type TestRoute = { component?: React.ComponentType };

function renderRoute(route: unknown, locale: UiLanguage) {
	const Component = (route as TestRoute).component;
	expect(Component).toBeTypeOf("function");
	return renderToStaticMarkup(<I18nProvider locale={locale}>{Component ? <Component /> : null}</I18nProvider>);
}

describe("Task 6 recovery and brand-image localization", () => {
	beforeEach(() => {
		mocks.search.redirect = "/app/brand-raw-id/prompts?scope=scope-cn#raw-fragment";
		mocks.branding = {
			name: "Evidence Portal",
			icon: "/raw-icon.svg",
			wordmark: "/raw-wordmark.svg",
		};
	});

	it("localizes the anonymous home action without changing its return URL", () => {
		const markup = renderRoute(HomeRoute, "zh-CN");

		expect(markup).toContain(">登录<");
		expect(markup).toContain(
			'href="/auth/login?returnTo=%2Fapp%2Fbrand-raw-id%2Fprompts%3Fscope%3Dscope-cn%23raw-fragment"',
		);
		expect(markup).not.toContain("Sign In");
	});

	it("localizes the authenticated brand 404 and preserves the raw brand route identity", () => {
		const markup = renderRoute(BrandNotFoundRoute, "zh-CN");

		expect(markup).toContain("404 页面未找到");
		expect(markup).toContain("你访问的页面不存在。");
		expect(markup).toContain("返回");
		expect(markup).toContain("brand-raw-id");
		expect(markup).not.toContain("Go Back");
	});

	it("uses the raw product name as wordmark alt text without an English suffix", () => {
		const markup = renderToStaticMarkup(<Logo />);

		expect(markup).toContain('alt="Evidence Portal"');
		expect(markup).not.toContain("Evidence Portal logo");
	});

	it("makes the icon decorative when adjacent visible text already names the product", () => {
		mocks.branding.wordmark = "";
		const markup = renderToStaticMarkup(<Logo />);

		expect(markup).toContain('src="/raw-icon.svg" alt="" aria-hidden="true"');
		expect(markup).toContain(">Evidence Portal<");
	});
});
