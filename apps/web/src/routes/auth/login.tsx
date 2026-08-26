/**
 * /auth/login - Login page
 *
 * Local/cloud modes: email/password form.
 * Whitelabel mode: auto-redirects to Auth0 SSO (no form shown).
 */

import { IconBrandGoogle, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";
import { authClient } from "@workspace/lib/auth/client";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { useEffect, useState } from "react";
import { z } from "zod";
import FullPageCard from "@/components/full-page-card";
import { useI18n } from "@/i18n/provider";
import { safeReturnTo } from "@/lib/return-to";

export const Route = createFileRoute("/auth/login")({
	validateSearch: z.object({
		returnTo: z.string().optional(),
	}),
	component: LoginPage,
});

function LoginPage() {
	const { returnTo } = Route.useSearch();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const mode = context.clientConfig?.mode;
	const canRegister = context.clientConfig?.canRegister ?? false;

	if (mode === "whitelabel") {
		return <SSOLogin returnTo={returnTo} />;
	}

	return (
		<EmailPasswordLogin
			returnTo={returnTo}
			isDemo={mode === "demo"}
			isCloud={mode === "cloud"}
			canRegister={canRegister}
		/>
	);
}

function SSOLogin({ returnTo }: { returnTo?: string }) {
	const { t } = useI18n();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		authClient.signIn
			.sso({ providerId: "auth0-whitelabel", callbackURL: safeReturnTo(returnTo) })
			.then((result) => {
				if (cancelled) return;
				if (result.error) {
					setError(t("auth.login.startFailed"));
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError(t("common.error.unexpected"));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [returnTo, t]);

	if (error) {
		return (
			<FullPageCard title={t("auth.login.title")}>
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button className="w-full" onClick={() => window.location.reload()}>
					{t("auth.login.tryAgain")}
				</Button>
			</FullPageCard>
		);
	}

	return <FullPageCard title={t("auth.login.signingIn")} subtitle={t("auth.login.redirecting")} />;
}

export function EmailPasswordLogin({
	returnTo,
	isDemo,
	isCloud,
	canRegister,
}: {
	returnTo?: string;
	isDemo?: boolean;
	isCloud?: boolean;
	canRegister?: boolean;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [email, setEmail] = useState(isDemo ? "demo@example.com" : "");
	const [password, setPassword] = useState(isDemo ? "demo" : "");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await authClient.signIn.email({
				email,
				password,
			});

			if (result.error) {
				if (isCloud && result.error.status === 403) {
					setError(t("auth.login.verifyEmail"));
				} else {
					setError(t("auth.login.invalidCredentials"));
				}
				setLoading(false);
				return;
			}

			navigate({ to: safeReturnTo(returnTo) });
		} catch {
			setError(t("common.error.unexpected"));
			setLoading(false);
		}
	}

	return (
		<FullPageCard title={t("auth.login.title")} subtitle={isDemo ? undefined : t("auth.login.subtitle")}>
			{isCloud && (
				<div className="space-y-4 w-full pb-4">
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => authClient.signIn.social({ provider: "google", callbackURL: safeReturnTo(returnTo) })}
					>
						<IconBrandGoogle className="size-4" />
						{t("auth.login.continueGoogle")}
					</Button>
					<div className="flex items-center gap-3">
						<Separator className="flex-1" />
						<span className="text-xs text-muted-foreground">{t("auth.login.or")}</span>
						<Separator className="flex-1" />
					</div>
				</div>
			)}
			<form onSubmit={handleSubmit} className="space-y-4 w-full">
				{isDemo && <DemoCredentialsCallout />}
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				{!isDemo && (
					<>
						<div className="space-y-2">
							<Label htmlFor="email">{t("auth.field.email")}</Label>
							<Input
								id="email"
								type="email"
								placeholder={t("auth.field.emailPlaceholder")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="password">{t("auth.field.password")}</Label>
								{isCloud && (
									<Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
										{t("auth.login.forgotPassword")}
									</Link>
								)}
							</div>
							<Input
								id="password"
								type="password"
								placeholder={t("auth.field.passwordPlaceholder")}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
							/>
						</div>
					</>
				)}
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? t("auth.login.signingIn") : t("auth.login.title")}
				</Button>
			</form>
			{canRegister && (
				<p className="text-center text-sm text-muted-foreground pt-4">
					{t("auth.login.noAccount")}{" "}
					<Link
						to="/auth/register"
						search={returnTo ? { returnTo } : {}}
						className="text-primary hover:underline font-medium"
					>
						{t("auth.login.createOne")}
					</Link>
				</p>
			)}
		</FullPageCard>
	);
}

function DemoCredentialsCallout() {
	const { t } = useI18n();
	return (
		<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
			<IconInfoCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
			<div className="space-y-2">
				<p className="font-medium text-amber-900 dark:text-amber-100">{t("auth.login.demoAccount")}</p>
				<dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-900/90 dark:text-amber-100/80">
					<div className="flex items-center gap-1.5">
						<dt className="opacity-70">{t("auth.field.email")}</dt>
						<dd className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px]">demo@example.com</dd>
					</div>
					<div className="flex items-center gap-1.5">
						<dt className="opacity-70">{t("auth.field.password")}</dt>
						<dd className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px]">demo</dd>
					</div>
				</dl>
			</div>
		</div>
	);
}
