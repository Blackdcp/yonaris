/**
 * /auth/reset-password - Choose a new password from a reset link (cloud only)
 *
 * Better-auth redirects here with ?token=... on a valid link, or
 * ?error=INVALID_TOKEN on a bad one.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@workspace/lib/auth/client";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useState } from "react";
import { z } from "zod";
import FullPageCard from "@/components/full-page-card";
import { useI18n } from "@/i18n/provider";

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: z.object({
		token: z.string().optional(),
		error: z.string().optional(),
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { t } = useI18n();
	const { token, error: searchError } = Route.useSearch();
	const navigate = useNavigate();
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (searchError || !token) {
		return (
			<FullPageCard title={t("auth.reset.invalid")}>
				<p className="text-center text-sm text-muted-foreground w-full">
					<Link to="/auth/forgot-password" className="text-primary hover:underline font-medium">
						{t("auth.reset.requestNew")}
					</Link>
				</p>
			</FullPageCard>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (newPassword !== confirmPassword) {
			setError(t("auth.reset.noMatch"));
			return;
		}
		setLoading(true);

		try {
			const result = await authClient.resetPassword({ newPassword, token: token as string });
			if (result.error) {
				setError(t("auth.reset.failed"));
				setLoading(false);
				return;
			}
			navigate({ to: "/auth/login" });
		} catch {
			setError(t("common.error.unexpected"));
			setLoading(false);
		}
	}

	return (
		<FullPageCard title={t("auth.reset.title")}>
			<form onSubmit={handleSubmit} className="space-y-4 w-full">
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				<div className="space-y-2">
					<Label htmlFor="new-password">{t("auth.reset.newPassword")}</Label>
					<Input
						id="new-password"
						type="password"
						placeholder={t("auth.reset.newPassword")}
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						required
						autoComplete="new-password"
						minLength={8}
						autoFocus
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="confirm-password">{t("auth.reset.confirmPassword")}</Label>
					<Input
						id="confirm-password"
						type="password"
						placeholder={t("auth.reset.confirmPassword")}
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						required
						autoComplete="new-password"
						minLength={8}
					/>
				</div>
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? t("auth.reset.resetting") : t("auth.reset.reset")}
				</Button>
			</form>
		</FullPageCard>
	);
}
