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

export const Route = createFileRoute("/_authed/admin/access")({
	component: CustomerAccessPage,
});

function OneTimeCredentialDialog({ value, onClose }: { value: OneTimeCredential | null; onClose: () => void }) {
	return (
		<Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>One-time customer credentials</DialogTitle>
					<DialogDescription>
						Copy these credentials now. The password is not stored in recoverable form and will not be shown again.
					</DialogDescription>
				</DialogHeader>
				{value && (
					<div className="space-y-4 rounded-lg border bg-muted/30 p-4 text-sm">
						<div>
							<div className="text-muted-foreground">Customer workspace</div>
							<div className="font-medium">{value.brandName}</div>
						</div>
						<div>
							<div className="text-muted-foreground">Email</div>
							<code className="select-all break-all">{value.email}</code>
						</div>
						<div>
							<div className="text-muted-foreground">Temporary password</div>
							<code className="select-all break-all">{value.temporaryPassword}</code>
						</div>
						{value.workspaceRole && (
							<div>
								<div className="text-muted-foreground">Role</div>
								<div>{value.workspaceRole}</div>
							</div>
						)}
					</div>
				)}
				<DialogFooter>
					<Button onClick={onClose}>I have saved it</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CustomerAccessPage() {
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
					<h1 className="text-3xl font-bold tracking-tight">Customer access</h1>
					<p className="text-muted-foreground">
						Create ordinary customer identities for delivery and QA. These accounts never receive platform automation,
						report, provider, or cross-customer permissions.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
						<DialogTrigger asChild>
							<Button variant="outline">Create customer workspace</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create customer workspace</DialogTitle>
								<DialogDescription>
									Creates one organization and one brand. Your platform identity is not added as a customer member.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="workspace-name">Customer or brand name</Label>
									<Input
										id="workspace-name"
										value={workspaceName}
										onChange={(event) => setWorkspaceName(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="workspace-website">Website</Label>
									<Input
										id="workspace-website"
										placeholder="https://example.com"
										value={workspaceWebsite}
										onChange={(event) => setWorkspaceWebsite(event.target.value)}
									/>
								</div>
								{createWorkspace.error && <p className="text-sm text-destructive">{String(createWorkspace.error)}</p>}
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setWorkspaceOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={() => createWorkspace.mutate()}
									disabled={!workspaceName.trim() || !workspaceWebsite.trim() || createWorkspace.isPending}
								>
									{createWorkspace.isPending ? "Creating..." : "Create workspace"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button disabled={!effectiveBrandId}>Create customer account</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create customer account</DialogTitle>
								<DialogDescription>
									The account is restricted to the selected customer workspace. A temporary password is shown once.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="customer-name">Name</Label>
									<Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="customer-email">Email</Label>
									<Input
										id="customer-email"
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label>Customer role</Label>
									<Select
										value={workspaceRole}
										onValueChange={(value) => setWorkspaceRole(value as CustomerWorkspaceRole)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="owner">Owner</SelectItem>
											<SelectItem value="admin">Admin</SelectItem>
											<SelectItem value="analyst">Analyst</SelectItem>
											<SelectItem value="viewer">Viewer</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{createAccount.error && <p className="text-sm text-destructive">{String(createAccount.error)}</p>}
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setCreateOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={() => createAccount.mutate()}
									disabled={!name.trim() || !email.trim() || createAccount.isPending}
								>
									{createAccount.isPending ? "Creating..." : "Create account"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Workspace access</CardTitle>
					<CardDescription>
						Platform administrators are deliberately separated from these customer identities.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Select value={effectiveBrandId} onValueChange={setBrandId}>
						<SelectTrigger className="max-w-md">
							<SelectValue placeholder="Select customer workspace" />
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
									<TableHead>Account</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Boundary</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{access.data?.accounts.map((entry) => (
									<TableRow key={entry.membershipId}>
										<TableCell>
											<div className="font-medium">{entry.name}</div>
											<div className="text-xs text-muted-foreground">{entry.email}</div>
										</TableCell>
										<TableCell className="capitalize">{entry.workspaceRole}</TableCell>
										<TableCell>
											{entry.isCustomerAccount ? (
												<Badge variant="secondary">Customer only</Badge>
											) : (
												<Badge variant="destructive">Platform identity</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												disabled={!entry.isCustomerAccount || resetPassword.isPending}
												onClick={() => resetPassword.mutate(entry.userId)}
											>
												Reset password
											</Button>
										</TableCell>
									</TableRow>
								))}
								{!access.isLoading && access.data?.accounts.length === 0 && (
									<TableRow>
										<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
											No customer accounts yet.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					{access.error && <p className="text-sm text-destructive">{String(access.error)}</p>}
				</CardContent>
			</Card>

			<OneTimeCredentialDialog value={oneTimeCredential} onClose={() => setOneTimeCredential(null)} />
		</div>
	);
}
