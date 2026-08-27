import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { useState } from "react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
import { createBrandWithOrgFn } from "@/server/brands";
import {
	type CustomerWorkspaceRole,
	createCustomerAccessFn,
	listCustomerAccessFn,
	listCustomerWorkspacesFn,
	resetCustomerAccessPasswordFn,
} from "@/server/customer-access";

type OneTimeCredential = {
	brandName: string;
	email: string;
	temporaryPassword: string;
	workspaceRole?: CustomerWorkspaceRole;
};

const ROLE_LABELS: Record<CustomerWorkspaceRole, MessageId> = {
	owner: "admin.access.role.owner",
	admin: "admin.access.role.admin",
	analyst: "admin.access.role.analyst",
	viewer: "admin.access.role.viewer",
};

const PUBLIC_ROLE_LABELS: Record<CustomerWorkspaceRole | "legacy-member" | "unknown", MessageId> = {
	...ROLE_LABELS,
	"legacy-member": "admin.access.role.legacyMember",
	unknown: "admin.access.role.unknown",
};

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

export const Route = createFileRoute("/_authed/admin/access")({
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "admin.access.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "admin.access.head.description") },
			],
		};
	},
	component: CustomerAccessPage,
});

function OneTimeCredentialDialog({ value, onClose }: { value: OneTimeCredential | null; onClose: () => void }) {
	const { t } = useI18n();
	return (
		<Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("admin.access.credentials.title")}</DialogTitle>
					<DialogDescription>{t("admin.access.credentials.description")}</DialogDescription>
				</DialogHeader>
				{value && (
					<div className="space-y-4 rounded-lg border bg-muted/30 p-4 text-sm">
						<div>
							<div className="text-muted-foreground">{t("admin.access.credentials.workspace")}</div>
							<div className="font-medium">{value.brandName}</div>
						</div>
						<div>
							<div className="text-muted-foreground">{t("admin.access.credentials.email")}</div>
							<code className="select-all break-all">{value.email}</code>
						</div>
						<div>
							<div className="text-muted-foreground">{t("admin.access.credentials.password")}</div>
							<code className="select-all break-all">{value.temporaryPassword}</code>
						</div>
						{value.workspaceRole && (
							<div>
								<div className="text-muted-foreground">{t("admin.access.credentials.role")}</div>
								<div>{t(ROLE_LABELS[value.workspaceRole])}</div>
							</div>
						)}
					</div>
				)}
				<DialogFooter>
					<Button onClick={onClose}>{t("admin.access.credentials.saved")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CustomerAccessPage() {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [brandId, setBrandId] = useState<string>("");
	const [workspaceOpen, setWorkspaceOpen] = useState(false);
	const [workspaceName, setWorkspaceName] = useState("");
	const [workspaceWebsite, setWorkspaceWebsite] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [workspaceRole, setWorkspaceRole] = useState<CustomerWorkspaceRole>("viewer");
	const [oneTimeCredential, setOneTimeCredential] = useState<OneTimeCredential | null>(null);

	const workspaces = useQuery({
		queryKey: ["platform", "customer-workspaces"],
		queryFn: () => listCustomerWorkspacesFn(),
	});
	const effectiveBrandId = brandId || workspaces.data?.[0]?.id || "";
	const access = useQuery({
		queryKey: ["platform", "customer-access", effectiveBrandId],
		queryFn: () => listCustomerAccessFn({ data: { brandId: effectiveBrandId } }),
		enabled: Boolean(effectiveBrandId),
	});
	const createAccount = useMutation({
		mutationFn: () =>
			createCustomerAccessFn({
				data: { brandId: effectiveBrandId, name, email, workspaceRole },
			}),
		onSuccess: (result) => {
			setOneTimeCredential(result);
			setCreateOpen(false);
			setName("");
			setEmail("");
			queryClient.invalidateQueries({ queryKey: ["platform", "customer-access", effectiveBrandId] });
		},
	});
	const createWorkspace = useMutation({
		mutationFn: () =>
			createBrandWithOrgFn({
				data: { brandName: workspaceName, website: workspaceWebsite },
			}),
		onSuccess: async (result) => {
			setWorkspaceOpen(false);
			setWorkspaceName("");
			setWorkspaceWebsite("");
			setBrandId(result.brandId);
			await queryClient.invalidateQueries({ queryKey: ["platform", "customer-workspaces"] });
		},
	});
	const resetPassword = useMutation({
		mutationFn: (userId: string) => resetCustomerAccessPasswordFn({ data: { brandId: effectiveBrandId, userId } }),
		onSuccess: (result) => setOneTimeCredential(result),
	});

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{t("admin.access.title")}</h1>
					<p className="text-muted-foreground">{t("admin.access.description")}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
						<DialogTrigger asChild>
							<Button variant="outline">
								{createWorkspace.isPending ? t("admin.access.workspace.creating") : t("admin.access.workspace.create")}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{t("admin.access.workspace.create")}</DialogTitle>
								<DialogDescription>{t("admin.access.workspace.description")}</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="workspace-name">{t("admin.access.workspace.name")}</Label>
									<Input
										id="workspace-name"
										value={workspaceName}
										onChange={(event) => setWorkspaceName(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="workspace-website">{t("admin.access.workspace.website")}</Label>
									<Input
										id="workspace-website"
										placeholder="https://example.com"
										value={workspaceWebsite}
										onChange={(event) => setWorkspaceWebsite(event.target.value)}
									/>
								</div>
								{createWorkspace.error && (
									<div className="text-sm text-destructive">
										<p>{t("admin.access.error.createWorkspace")}</p>
										<LocalizedRawDetail
											labelId="admin.raw.errorDetails"
											detail={rawErrorDetail(createWorkspace.error) ?? ""}
										/>
									</div>
								)}
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setWorkspaceOpen(false)}>
									{t("admin.access.workspace.cancel")}
								</Button>
								<Button
									onClick={() => createWorkspace.mutate()}
									disabled={!workspaceName.trim() || !workspaceWebsite.trim() || createWorkspace.isPending}
								>
									{t(createWorkspace.isPending ? "admin.access.workspace.creating" : "admin.access.workspace.submit")}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button disabled={!effectiveBrandId}>
								{createAccount.isPending ? t("admin.access.account.creating") : t("admin.access.account.create")}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{t("admin.access.account.create")}</DialogTitle>
								<DialogDescription>{t("admin.access.account.description")}</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="customer-name">{t("admin.access.account.name")}</Label>
									<Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="customer-email">{t("admin.access.account.email")}</Label>
									<Input
										id="customer-email"
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label>{t("admin.access.account.role")}</Label>
									<Select
										value={workspaceRole}
										onValueChange={(value) => setWorkspaceRole(value as CustomerWorkspaceRole)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="owner">{t("admin.access.role.owner")}</SelectItem>
											<SelectItem value="admin">{t("admin.access.role.admin")}</SelectItem>
											<SelectItem value="analyst">{t("admin.access.role.analyst")}</SelectItem>
											<SelectItem value="viewer">{t("admin.access.role.viewer")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{createAccount.error && (
									<div className="text-sm text-destructive">
										<p>{t("admin.access.error.createAccount")}</p>
										<LocalizedRawDetail
											labelId="admin.raw.errorDetails"
											detail={rawErrorDetail(createAccount.error) ?? ""}
										/>
									</div>
								)}
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setCreateOpen(false)}>
									{t("admin.access.account.cancel")}
								</Button>
								<Button
									onClick={() => createAccount.mutate()}
									disabled={!name.trim() || !email.trim() || createAccount.isPending}
								>
									{t(createAccount.isPending ? "admin.access.account.creating" : "admin.access.account.submit")}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("admin.access.list.title")}</CardTitle>
					<CardDescription>{t("admin.access.list.description")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{workspaces.isLoading && (
						<p className="text-sm text-muted-foreground">{t("admin.access.workspace.loading")}</p>
					)}
					{!workspaces.isLoading && !workspaces.error && workspaces.data?.length === 0 && (
						<p className="text-sm text-muted-foreground">{t("admin.access.workspace.empty")}</p>
					)}
					<Select value={effectiveBrandId} onValueChange={setBrandId}>
						<SelectTrigger className="max-w-md">
							<SelectValue placeholder={t("admin.access.list.selectWorkspace")} />
						</SelectTrigger>
						<SelectContent>
							{workspaces.data?.map((workspace) => (
								<SelectItem key={workspace.id} value={workspace.id}>
									{workspace.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("admin.access.list.column.account")}</TableHead>
									<TableHead>{t("admin.access.list.column.role")}</TableHead>
									<TableHead>{t("admin.access.list.column.boundary")}</TableHead>
									<TableHead className="text-right">{t("admin.access.list.column.action")}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{access.data?.accounts.map((entry) => (
									<TableRow key={entry.membershipId}>
										<TableCell>
											<div className="font-medium">{entry.name}</div>
											<div className="text-xs text-muted-foreground">{entry.email}</div>
										</TableCell>
										<TableCell>{t(PUBLIC_ROLE_LABELS[entry.workspaceRole])}</TableCell>
										<TableCell>
											{entry.isCustomerAccount ? (
												<Badge variant="secondary">{t("admin.access.boundary.customer")}</Badge>
											) : (
												<Badge variant="destructive">{t("admin.access.boundary.platform")}</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												disabled={!entry.isCustomerAccount || resetPassword.isPending}
												onClick={() => resetPassword.mutate(entry.userId)}
											>
												{t(resetPassword.isPending ? "admin.access.resetting" : "admin.access.reset")}
											</Button>
										</TableCell>
									</TableRow>
								))}
								{!access.isLoading && access.data?.accounts.length === 0 && (
									<TableRow>
										<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
											{t("admin.access.empty")}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					{access.isLoading && <p className="text-sm text-muted-foreground">{t("admin.access.list.loading")}</p>}
					{workspaces.error && (
						<div className="text-sm text-destructive">
							<p>{t("admin.access.error.workspaces")}</p>
							<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={rawErrorDetail(workspaces.error) ?? ""} />
						</div>
					)}
					{access.error && (
						<div className="text-sm text-destructive">
							<p>{t("admin.access.error.accounts")}</p>
							<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={rawErrorDetail(access.error) ?? ""} />
						</div>
					)}
					{resetPassword.error && (
						<div className="text-sm text-destructive">
							<p>{t("admin.access.error.reset")}</p>
							<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={rawErrorDetail(resetPassword.error) ?? ""} />
						</div>
					)}
				</CardContent>
			</Card>

			<OneTimeCredentialDialog value={oneTimeCredential} onClose={() => setOneTimeCredential(null)} />
		</div>
	);
}
