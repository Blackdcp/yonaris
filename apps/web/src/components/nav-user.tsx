import { IconExternalLink, IconLogout, IconSelector, IconStatusChange, IconUser } from "@tabler/icons-react";
import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";
import { authClient } from "@workspace/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useSidebar } from "@workspace/ui/components/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n/provider";
import { resetPostHog } from "@/lib/posthog";
import { LanguageSwitcher } from "@/components/language-switcher";

export function NavUser() {
	const { user } = useAuth();
	const { t } = useI18n();
	const { setOpenMobile } = useSidebar();
	const { pathname } = useLocation();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const clientConfig = context.clientConfig;
	const isPlatformPage = pathname.startsWith("/admin") || pathname.startsWith("/reports");

	// NavUser only renders inside _authed routes, which redirect to /auth/login
	// when there's no session — so `user` is always present at this point.
	if (!user) return null;

	const isNameEmailSame = user.name?.trim().toLowerCase() === user.email?.trim().toLowerCase();
	const displayName = user.name || user.email || t("nav.account.fallback");

	return (
		<div data-slot="header-user-menu">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						aria-label={t("nav.account.menuLabel", { name: displayName })}
						className="h-10 max-w-56 cursor-pointer gap-2 rounded-md px-2 data-[state=open]:bg-accent"
					>
						<Avatar className="size-7 rounded-md">
							<AvatarImage src={user.picture} alt={displayName} />
							<AvatarFallback className="rounded-md bg-secondary text-secondary-foreground">
								<IconUser className="size-4" />
							</AvatarFallback>
						</Avatar>
						<div className="hidden min-w-0 text-left leading-tight sm:grid">
							<span className="truncate text-xs font-semibold">{displayName}</span>
							<span className="truncate text-[10px] font-normal text-muted-foreground">
								{isPlatformPage ? t("nav.account.platform") : t("nav.account.customer")}
							</span>
						</div>
						<IconSelector className="hidden size-3.5 text-muted-foreground sm:block" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-64 rounded-lg" side="bottom" align="end" sideOffset={8}>
					<DropdownMenuLabel className="p-0 font-normal">
						<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
							<Avatar className="h-8 w-8 rounded-md">
								<AvatarImage src={user.picture} alt={displayName} />
								<AvatarFallback className="rounded-md bg-secondary text-secondary-foreground">
									<IconUser className="size-4" />
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{displayName}</span>
								<span className="truncate text-xs">{isNameEmailSame ? t("nav.account.yours") : user.email}</span>
							</div>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						{!isPlatformPage && (
							<DropdownMenuItem asChild className="cursor-pointer">
								<Link to="/app" onClick={() => setOpenMobile(false)}>
									<IconStatusChange />
									{t("nav.account.switchWorkspace")}
								</Link>
							</DropdownMenuItem>
						)}
						{clientConfig?.branding.parentUrl && clientConfig?.branding.parentName && (
							<DropdownMenuItem asChild className="cursor-pointer">
								<a href={clientConfig.branding.parentUrl} target="_blank" rel="noreferrer">
									<IconExternalLink />
									{t("nav.account.parentDashboard", { parentName: clientConfig.branding.parentName })}
								</a>
							</DropdownMenuItem>
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<div className="px-1 py-1.5">
						<LanguageSwitcher className="w-full justify-center" />
					</div>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										resetPostHog();
										window.location.href = "/auth/logout";
									},
								},
							});
						}}
					>
						<IconLogout />
						{t("nav.account.logOut")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
