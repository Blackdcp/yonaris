import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from "@workspace/ui/components/navigation-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { ArrowRight } from "lucide-react";
import { Logo } from "./logo";

const navigationLinks = [
	{ href: "/features", label: "Features" },
	{ href: "/status", label: "Provider Status" },
	{ href: "/docs", label: "Docs" },
];

export function Navbar() {
	return (
		<header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
				<div className="flex items-center gap-3 md:gap-8">
					<Popover>
						<PopoverTrigger asChild>
							<Button className="group size-8 md:hidden" variant="ghost" size="icon" aria-label="Open menu">
								<svg
									aria-hidden="true"
									className="pointer-events-none"
									width={16}
									height={16}
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path
										d="M4 12L20 12"
										className="origin-center -translate-y-[7px] transition-all duration-300 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
									/>
									<path d="M4 12H20" className="origin-center transition-all duration-300 group-aria-expanded:rotate-45" />
									<path
										d="M4 12H20"
										className="origin-center translate-y-[7px] transition-all duration-300 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
									/>
								</svg>
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-44 p-1 md:hidden">
							<NavigationMenu className="max-w-none *:w-full">
								<NavigationMenuList className="flex-col items-start gap-0">
									{navigationLinks.map((link) => (
										<NavigationMenuItem key={link.href} className="w-full">
											<NavigationMenuLink href={link.href} className="py-1.5">
												{link.label}
											</NavigationMenuLink>
										</NavigationMenuItem>
									))}
								</NavigationMenuList>
							</NavigationMenu>
						</PopoverContent>
					</Popover>
					<Link to="/" aria-label="Yonaris homepage" className="flex items-center">
						<Logo className="h-7" />
					</Link>
					<NavigationMenu className="mx-auto max-md:hidden">
						<NavigationMenuList className="gap-1">
							{navigationLinks.map((link) => (
								<NavigationMenuItem key={link.href}>
									<NavigationMenuLink href={link.href} className="py-1.5 font-medium text-zinc-600 hover:text-zinc-950">
										{link.label}
									</NavigationMenuLink>
								</NavigationMenuItem>
							))}
						</NavigationMenuList>
					</NavigationMenu>
				</div>
				<Link
					to="/docs"
					className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium leading-none text-white ring-1 ring-blue-600 hover:bg-blue-700"
				>
					Get Started
					<ArrowRight className="size-3.5" />
				</Link>
			</div>
		</header>
	);
}
