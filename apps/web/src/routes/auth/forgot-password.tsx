/**
 * /auth/forgot-password - Request a password reset email (cloud only)
 *
 * Always renders the same neutral confirmation whether or not the account
 * exists, to avoid account enumeration.
 */

import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";
import { authClient } from "@workspace/lib/auth/client";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useState } from "react";
import FullPageCard from "@/components/full-page-card";
import { useI18n } from "@/i18n/provider";

export const Route = createFileRoute("/auth/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { t } = useI18n();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	if (context.clientConfig?.mode !== "cloud") {
		window.location.href = "/auth/login";
		return null;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		try {
			await authClient.requestPasswordReset({ email, redirectTo: "/auth/reset-password" });
		} catch {
			// Same neutral confirmation on failure — no account enumeration.
		}
		setSubmitted(true);
		setLoading(false);
	}

	if (submitted) {
		return (
			<FullPageCard title={t("auth.forgot.checkEmail")} subtitle={t("auth.forgot.confirmation", { email })}>
				<p className="text-center text-sm text-muted-foreground w-full">
					<Link to="/auth/login" className="text-primary hover:underline font-medium">
						{t("auth.forgot.back")}
					</Link>
				</p>
			</FullPageCard>
		);
	}

	return (
		<FullPageCard title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
			<form onSubmit={handleSubmit} className="space-y-4 w-full">
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
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? t("auth.forgot.sending") : t("auth.forgot.send")}
				</Button>
			</form>
			<p className="text-center text-sm text-muted-foreground pt-4">
				<Link to="/auth/login" className="text-primary hover:underline font-medium">
					{t("auth.forgot.back")}
				</Link>
			</p>
		</FullPageCard>
	);
}
