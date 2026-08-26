/**
 * /app/$brand/settings/members - Team settings page (cloud only)
 *
 * Invite teammates by email, list current members, and manage pending
 * invitations. The redirect in the loader is UX only — the security
 * boundary is the teamInvites guard inside every team server function.
 */
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { useState } from "react";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { getDeployment } from "@/lib/config/server";
import { trackEvent } from "@/lib/posthog";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { cancelInvitationFn, inviteTeamMemberFn, listTeamFn, removeTeamMemberFn, type TeamData } from "@/server/team";

type InviteRole = "member" | "admin";
type InviteTeamMember = (input: { data: { brandId: string; email: string; role: InviteRole } }) => Promise<unknown>;

export type TeamInviteSubmissionResult =
	| { ok: true; submitted: { brandId: string; email: string; role: InviteRole } }
	| { ok: false; fieldErrors: { email: MessageId }; formError?: never }
	| { ok: false; fieldErrors?: never; formError: MessageId };

export function teamErrorMessageId(action: "invite" | "remove" | "cancel", error: unknown): MessageId {
	const operation = action === "invite" ? "teamInvite" : action === "remove" ? "teamRemove" : "teamCancel";
	return customerSettingsErrorMessageId(operation, error);
}

export async function submitTeamInviteForm(
	input: { brandId: string; email: string; role: InviteRole },
	invite: InviteTeamMember,
): Promise<TeamInviteSubmissionResult> {
	if (!input.email.trim()) {
		return { ok: false, fieldErrors: { email: "settings.team.validation.emailRequired" } };
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
		return { ok: false, fieldErrors: { email: "settings.team.validation.emailInvalid" } };
	}

	try {
		await invite({ data: input });
		return { ok: true, submitted: input };
	} catch (error) {
		return { ok: false, formError: teamErrorMessageId("invite", error) };
	}
}

const getTeamInvitesEnabled = createServerFn({ method: "GET" }).handler(async () => {
	return { teamInvites: getDeployment().features.teamInvites };
});

export const Route = createFileRoute("/_authed/app/$brand/settings/members")({
	loader: async ({ params }): Promise<TeamData> => {
		const { teamInvites } = await getTeamInvitesEnabled();
		if (!teamInvites) {
			throw redirect({ to: "/app/$brand", params: { brand: params.brand } });
		}
		return listTeamFn({ data: { brandId: params.brand } });
	},
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "settings.team.metaTitle"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "settings.team.metaDescription") },
			],
		};
	},
	component: TeamSettingsPage,
});

function TeamSettingsPage() {
	const { t, formatDate } = useI18n();
	const { brand: brandId } = Route.useParams();
	const team: TeamData = Route.useLoaderData();
	const { members, invitations, currentUserId } = team;
	const router = useRouter();
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<InviteRole>("member");
	const [inviting, setInviting] = useState(false);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [formError, setFormError] = useState<MessageId | null>(null);
	const [inviteEmailError, setInviteEmailError] = useState<MessageId | null>(null);

	const roleLabel = (role: string | null | undefined) => {
		if (role === "admin") return t("settings.team.role.admin");
		if (role === "owner") return t("settings.team.role.owner");
		if (!role || role === "member") return t("settings.team.role.member");
		return role;
	};

	async function handleInvite(event: React.FormEvent) {
		event.preventDefault();
		setFormError(null);
		setInviteEmailError(null);
		setInviting(true);
		try {
			const result = await submitTeamInviteForm({ brandId, email: inviteEmail, role: inviteRole }, inviteTeamMemberFn);
			if (!result.ok) {
				setInviteEmailError(result.fieldErrors?.email ?? null);
				setFormError(result.formError ?? null);
				return;
			}
			trackEvent("team_member_invited", { role: result.submitted.role });
			setInviteEmail("");
			setInviteRole("member");
			await router.invalidate();
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setInviting(false);
		}
	}

	async function handleRemove(memberId: string) {
		setFormError(null);
		setPendingAction(`remove:${memberId}`);
		try {
			await removeTeamMemberFn({ data: { brandId, memberId } });
			await router.invalidate();
		} catch (error) {
			setFormError(teamErrorMessageId("remove", error));
		} finally {
			setPendingAction(null);
		}
	}

	async function handleCancel(invitationId: string) {
		setFormError(null);
		setPendingAction(`cancel:${invitationId}`);
		try {
			await cancelInvitationFn({ data: { brandId, invitationId } });
			await router.invalidate();
		} catch (error) {
			setFormError(teamErrorMessageId("cancel", error));
		} finally {
			setPendingAction(null);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">{t("settings.team.title")}</h1>
				<p className="text-muted-foreground">{t("settings.team.description")}</p>
			</div>

			{formError && (
				<Alert variant="destructive">
					<AlertDescription>{t(formError)}</AlertDescription>
				</Alert>
			)}

			<form noValidate onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
				<div className="space-y-2">
					<Label htmlFor="invite-email">{t("settings.team.email")}</Label>
					<Input
						id="invite-email"
						name="email"
						type="email"
						placeholder={t("settings.team.emailPlaceholder")}
						value={inviteEmail}
						onChange={(event) => {
							setInviteEmail(event.target.value);
							setInviteEmailError(null);
						}}
						required
						aria-invalid={inviteEmailError !== null}
						aria-describedby={inviteEmailError ? "invite-email-error" : undefined}
						disabled={inviting}
						className="w-64"
					/>
					{inviteEmailError && (
						<p id="invite-email-error" role="alert" className="text-sm text-destructive">
							{t(inviteEmailError)}
						</p>
					)}
				</div>
				<div className="space-y-2">
					<Label htmlFor="invite-role">{t("settings.team.role")}</Label>
					<Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)} disabled={inviting}>
						<SelectTrigger id="invite-role" className="w-32" aria-label={t("settings.team.role")}>
							<SelectValue>{roleLabel(inviteRole)}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="member">{t("settings.team.role.member")}</SelectItem>
							<SelectItem value="admin">{t("settings.team.role.admin")}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button type="submit" disabled={inviting}>
					{inviting ? t("settings.team.inviting") : t("settings.team.invite")}
				</Button>
			</form>

			<div className="space-y-3">
				<h2 className="text-lg font-semibold">{t("settings.team.members")}</h2>
				<div className="divide-y rounded-md border">
					{members.map((member) => (
						<div key={member.id} className="flex items-center justify-between gap-3 p-3">
							<div className="min-w-0">
								<p className="truncate font-medium">{member.name}</p>
								<p className="truncate text-sm text-muted-foreground">{member.email}</p>
							</div>
							<div className="flex shrink-0 items-center gap-3">
								<Badge variant="secondary">{roleLabel(member.role)}</Badge>
								{member.userId !== currentUserId && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => handleRemove(member.id)}
										disabled={pendingAction !== null}
									>
										{pendingAction === `remove:${member.id}` ? t("settings.team.removing") : t("settings.team.remove")}
									</Button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			{invitations.length > 0 && (
				<div className="space-y-3">
					<h2 className="text-lg font-semibold">{t("settings.team.pending")}</h2>
					<div className="divide-y rounded-md border">
						{invitations.map((invitation) => (
							<div key={invitation.id} className="flex items-center justify-between gap-3 p-3">
								<div className="min-w-0">
									<p className="truncate font-medium">{invitation.email}</p>
									<p className="text-sm text-muted-foreground">
										{t("settings.team.expires", {
											date: formatDate(new Date(invitation.expiresAt)),
										})}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-3">
									<Badge variant="secondary">{roleLabel(invitation.role)}</Badge>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => handleCancel(invitation.id)}
										disabled={pendingAction !== null}
									>
										{pendingAction === `cancel:${invitation.id}`
											? t("settings.team.cancelling")
											: t("settings.team.cancel")}
									</Button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
