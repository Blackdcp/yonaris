import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => ({ ...(options as object), useSearch: () => ({}) }),
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
	useNavigate: () => vi.fn(),
	useRouteContext: () => ({ clientConfig: { mode: "local", canRegister: true, hasUsers: true } }),
}));
vi.mock("@workspace/lib/auth/client", () => ({
	authClient: {
		signIn: { email: vi.fn(), social: vi.fn(), sso: vi.fn() },
		signUp: { email: vi.fn() },
		sendVerificationEmail: vi.fn(),
	},
}));
vi.mock("@/components/logo", () => ({ Logo: () => <span>Yonaris</span> }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ identifyUser: vi.fn(), setPersonProperties: vi.fn() }));

import { completeAuthenticationNavigation } from "@/lib/auth/navigation";
import { EmailPasswordLogin, buildSocialSignInInput, buildSsoSignInInput } from "./login";
import { buildEmailSignUpInput } from "./register";

describe("localized authentication helpers", () => {
	it.each([
		["en", "Sign in", "Email", "Password"],
		["zh-CN", "登录", "邮箱", "密码"],
	] as const)("renders the login form in %s", (locale, title, email, password) => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<EmailPasswordLogin />
			</I18nProvider>,
		);

		expect(markup).toContain(title);
		expect(markup).toContain('<h1 data-slot="card-title"');
		expect(markup).toContain(`>${title}</h1>`);
		expect(markup).toContain(email);
		expect(markup).toContain(password);
	});

	it("includes the current valid UI language in the first sign-up request", () => {
		expect(
			buildEmailSignUpInput({
				email: "new@example.com",
				password: "correct horse battery staple",
				name: "New User",
				uiLanguage: "zh-CN",
				isCloud: true,
				returnTo: "/app/acme",
			}),
		).toEqual({
			email: "new@example.com",
			password: "correct horse battery staple",
			name: "New User",
			uiLanguage: "zh-CN",
			callbackURL: "/app/acme",
		});
	});

	it("uses a hard, same-origin navigation after email authentication", () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { origin: "https://portal.example.com", assign } });

		completeAuthenticationNavigation("https://portal.example.com/app/acme?tab=prompts#latest");

		expect(assign).toHaveBeenCalledWith("/app/acme?tab=prompts#latest");
	});

	it("rejects a cross-origin email-authentication return target", () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { origin: "https://portal.example.com", assign } });

		completeAuthenticationNavigation("https://attacker.example/phish");

		expect(assign).toHaveBeenCalledWith("/app");
	});

	it("uses safe callback URLs for Google and Auth0 SSO", () => {
		vi.stubGlobal("window", { location: { origin: "https://portal.example.com" } });

		expect(buildSocialSignInInput("//attacker.example/phish")).toEqual({
			provider: "google",
			callbackURL: "/app",
		});
		expect(buildSsoSignInInput("https://portal.example.com/app/acme")).toEqual({
			providerId: "auth0-whitelabel",
			callbackURL: "/app/acme",
		});
	});
});
