import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getClientConfig: vi.fn(),
	getEnvValidationState: vi.fn(),
	getUiLanguage: vi.fn(),
	context: {
		uiLanguage: "en" as "en" | "zh-CN",
		clientConfig: {
			mode: "local",
			branding: { name: "Yonaris", icon: "/icon.svg" },
			analytics: {},
		},
		envValidation: { mode: "local", missing: [], isValid: true },
	},
}));

vi.mock("@tanstack/react-router", () => ({
	createRootRouteWithContext: () => (options: unknown) => ({
		...(options as object),
		options,
		useRouteContext: () => mocks.context,
	}),
	HeadContent: () => null,
	Outlet: () => <main>route content</main>,
	ScriptOnce: ({ children }: { children: ReactNode }) => <script>{children}</script>,
	Scripts: () => null,
}));
vi.mock("@tanstack/react-devtools", () => ({ TanStackDevtools: () => null }));
vi.mock("@/components/missing-env-page", () => ({ default: () => <main>missing configuration</main> }));
vi.mock("@/integrations/tanstack-query/devtools", () => ({ default: {} }));
vi.mock("@/lib/posthog", () => ({ initPostHog: vi.fn() }));
vi.mock("@/server/config", () => ({
	getClientConfig: mocks.getClientConfig,
	getEnvValidationStateFn: mocks.getEnvValidationState,
}));
vi.mock("@/server/ui-language", () => ({ getUiLanguageFn: mocks.getUiLanguage }));
vi.mock("@/router-default-components", () => ({ NotFound: () => null }));

import { RootComponent, Route, rootHeadContent } from "./__root";

describe("root locale SSR integration", () => {
	beforeEach(() => {
		mocks.context.uiLanguage = "en";
		mocks.context.envValidation.isValid = true;
	});

	it.each([
		["en", "en_US", "Yonaris - AI answer evidence"],
		["zh-CN", "zh_CN", "Yonaris - AI 回答证据"],
	] as const)("uses %s consistently in document markup and metadata", (locale, ogLocale, title) => {
		mocks.context.uiLanguage = locale;

		const markup = renderToStaticMarkup(<RootComponent />);
		const head = rootHeadContent({ appName: "Yonaris", uiLanguage: locale });

		expect(markup).toContain(`<html lang="${locale}">`);
		expect(head).toEqual({
			title,
			description:
				locale === "en"
					? "Track and optimize your brand's visibility across AI models."
					: "追踪并优化品牌在各类 AI 模型中的可见度。",
			ogLocale,
		});
	});

	it("keeps the missing-environment document language in sync", () => {
		mocks.context.uiLanguage = "zh-CN";
		mocks.context.envValidation.isValid = false;

		expect(renderToStaticMarkup(<RootComponent />)).toContain('<html lang="zh-CN">');
	});

	it("resolves language independently for consecutive server requests", async () => {
		mocks.getClientConfig.mockResolvedValue(mocks.context.clientConfig);
		mocks.getEnvValidationState.mockResolvedValue(mocks.context.envValidation);
		mocks.getUiLanguage.mockResolvedValueOnce("en").mockResolvedValueOnce("zh-CN");
		const beforeLoad = Route.options.beforeLoad as unknown as () => Promise<{ uiLanguage: "en" | "zh-CN" }>;

		const englishRequest = await beforeLoad();
		const chineseRequest = await beforeLoad();

		expect(englishRequest.uiLanguage).toBe("en");
		expect(chineseRequest.uiLanguage).toBe("zh-CN");
		expect(mocks.getUiLanguage).toHaveBeenCalledTimes(2);
	});
});
