import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
	useLocation: () => ({ pathname: "/app/acme" }),
	useRouteContext: () => ({
		clientConfig: { branding: { parentName: "Partner", parentUrl: "https://partner.example" } },
	}),
}));
vi.mock("@workspace/ui/components/sidebar", () => ({ useSidebar: () => ({ setOpenMobile: vi.fn() }) }));
vi.mock("@workspace/ui/components/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuSeparator: () => <hr />,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({ user: { id: "user-1", name: "Lin", email: "lin@example.com", picture: "" } }),
}));
vi.mock("@workspace/lib/auth/client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/lib/posthog", () => ({ resetPostHog: vi.fn() }));
vi.mock("@/server/ui-language", () => ({ setUiLanguageFn: vi.fn() }));

import { NavUser } from "./nav-user";

describe("NavUser localized navigation", () => {
	it("keeps customer destinations unchanged while rendering Chinese menu copy", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<NavUser />
			</I18nProvider>,
		);

		expect(markup).toContain("客户工作区");
		expect(markup).toContain("切换客户工作区");
		expect(markup).toContain("Partner 控制台");
		expect(markup).toContain("退出登录");
		expect(markup).toContain("English");
		expect(markup).toContain("简体中文");
		expect(markup).toContain('href="/app"');
		expect(markup).toContain('href="https://partner.example"');
	});
});
