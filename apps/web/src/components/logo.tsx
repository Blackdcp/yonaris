import { useRouteContext } from "@tanstack/react-router";
import {
	DEFAULT_APP_ICON,
	DEFAULT_APP_NAME,
	DEFAULT_APP_WORDMARK,
	DEFAULT_APP_WORDMARK_ON_DARK,
} from "@workspace/config/constants";
import type { ClientConfig } from "@workspace/config/types";
import { cn } from "@workspace/ui/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

interface LogoProps extends ComponentPropsWithoutRef<"div"> {
	iconClassName?: string;
	wordmarkClassName?: string;
	textClassName?: string;
	surface?: "auto" | "light" | "dark";
}

export function Logo({
	className,
	iconClassName,
	wordmarkClassName,
	textClassName,
	surface = "auto",
	...props
}: LogoProps) {
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const branding = context.clientConfig?.branding;
	const name = branding?.name || DEFAULT_APP_NAME;
	const icon = branding?.icon || DEFAULT_APP_ICON;
	const usesDefaultBrand = name === DEFAULT_APP_NAME && icon === DEFAULT_APP_ICON;
	const wordmark = branding?.wordmark || (usesDefaultBrand ? DEFAULT_APP_WORDMARK : undefined);
	const wordmarkOnDark = branding?.wordmarkOnDark || (usesDefaultBrand ? DEFAULT_APP_WORDMARK_ON_DARK : undefined);
	const wordmarkClasses = cn("h-7 w-auto max-w-40 object-contain", wordmarkClassName);

	if (wordmark) {
		if (surface !== "auto") {
			const src = surface === "dark" ? wordmarkOnDark || wordmark : wordmark;
			return (
				<div data-slot="brand-logo" {...props} className={cn("flex items-center gap-2", className)}>
					<img src={src} alt={name} className={wordmarkClasses} fetchPriority="low" decoding="async" />
				</div>
			);
		}

		return (
			<div data-slot="brand-logo" {...props} className={cn("flex items-center gap-2", className)}>
				<img
					src={wordmark}
					alt={name}
					className={cn(wordmarkClasses, wordmarkOnDark && "dark:hidden")}
					fetchPriority="low"
					decoding="async"
				/>
				{wordmarkOnDark && (
					<img
						src={wordmarkOnDark}
						alt=""
						aria-hidden="true"
						className={cn(wordmarkClasses, "hidden dark:block")}
						fetchPriority="low"
						decoding="async"
					/>
				)}
			</div>
		);
	}

	return (
		<div data-slot="brand-logo" {...props} className={cn("flex items-center gap-2", className)}>
			{icon && <img src={icon} alt="" aria-hidden="true" className={cn("size-5", iconClassName)} fetchPriority="low" />}
			<span className={cn("text-base font-semibold", textClassName)}>{name}</span>
		</div>
	);
}
