/**
 * /auth/register - Account registration page
 *
 * Available in local mode for the single bootstrap signup and in cloud mode
 * for public self-serve signup. Cloud requires email verification before
 * sign-in and also offers Google OAuth.
 */

import { IconBrandGoogle } from "@tabler/icons-react";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import type { UiLanguage } from "@workspace/config/language";
import type { ClientConfig } from "@workspace/config/types";
import { authClient } from "@workspace/lib/auth/client";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { useState } from "react";
import { z } from "zod";
import FullPageCard from "@/components/full-page-card";
import { useI18n } from "@/i18n/provider";
import { completeAuthenticationNavigation } from "@/lib/auth/navigation";
import { safeReturnTo } from "@/lib/return-to";
import { buildSocialSignInInput } from "./login";

type EmailSignUpInput = {
	email: string;
	password: string;
	name: string;
	uiLanguage: UiLanguage;
	callbackURL?: string;
};

export function buildEmailSignUpInput({
	email,
	password,
	name,
	uiLanguage,
	isCloud,
	returnTo,
}: Omit<EmailSignUpInput, "callbackURL"> & { isCloud: boolean; returnTo?: string }): EmailSignUpInput {
	return {
		email,
		password,
		name,
		uiLanguage,
		...(isCloud && { callbackURL: safeReturnTo(returnTo) }),
	};
}

export const Route = createFileRoute("/auth/register")({
	validateSearch: z.object({
		returnTo: z.string().optional(),
	}),
	component: RegisterPage,
});

function RegisterPage() {
	const { locale, t } = useI18n();
	const { returnTo } = Route.useSearch();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const canRegister = context.clientConfig?.canRegister ?? false;
	const hasUsers = context.clientConfig?.hasUsers ?? false;
	const isCloud = context.clientConfig?.mode === "cloud";
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [pendingVerification, setPendingVerification] = useState(false);
	const [resending, setResending] = useState(false);

	if (!canRegister) {
		window.location.href = "/auth/login";
		return null;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await authClient.signUp.email(
				buildEmailSignUpInput({
					email,
					password,
					name,
					uiLanguage: locale,
					isCloud,
					returnTo,
				}),
			);

			if (result.error) {
				setError(t("auth.register.failed"));
				setLoading(false);
				return;
			}

			if (isCloud) {
				setPendingVerification(true);
				setLoading(false);
				return;
			}

			completeAuthenticationNavigation(returnTo);
		} catch {
			setError(t("common.error.unexpected"));
			setLoading(false);
		}
	}

	async function handleResend() {
		setResending(true);
		try {
			await authClient.sendVerificationEmail({ email, callbackURL: safeReturnTo(returnTo) });
		} finally {
			setResending(false);
		}
	}

	if (pendingVerification) {
		return (
			<FullPageCard title={t("auth.register.checkEmail")} subtitle={t("auth.register.verificationSent", { email })}>
				<div className="space-y-4 w-full">
					<p className="text-sm text-muted-foreground text-center">{t("auth.register.verificationGuidance")}</p>
					<Button type="button" variant="outline" className="w-full" onClick={handleResend} disabled={resending}>
						{resending ? t("auth.register.sending") : t("auth.register.resend")}
					</Button>
				</div>
			</FullPageCard>
		);
	}

	return (
		<FullPageCard title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
			{isCloud && (
				<div className="space-y-4 w-full pb-4">
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => authClient.signIn.social(buildSocialSignInInput(returnTo))}
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
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				<div className="space-y-2">
					<Label htmlFor="name">{t("auth.field.name")}</Label>
					<Input
						id="name"
						type="text"
						placeholder={t("auth.field.namePlaceholder")}
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						autoComplete="name"
						autoFocus
					/>
				</div>
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
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="password">{t("auth.field.password")}</Label>
					<Input
						id="password"
						type="password"
						placeholder={t("auth.register.passwordPlaceholder")}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="new-password"
						minLength={isCloud ? 8 : 6}
					/>
				</div>
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? t("auth.register.creating") : t("auth.register.title")}
				</Button>
			</form>
			{hasUsers && (
				<p className="text-center text-sm text-muted-foreground pt-4">
					{t("auth.register.hasAccount")}{" "}
					<Link
						to="/auth/login"
						search={returnTo ? { returnTo } : {}}
						className="text-primary hover:underline font-medium"
					>
						{t("auth.login.title")}
					</Link>
				</p>
			)}
		</FullPageCard>
	);
}
