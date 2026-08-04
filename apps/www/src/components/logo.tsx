import { cn } from "@workspace/ui/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

const WORDMARKS = {
	navy: "/brand/logos/yonaris-wordmark-navy.png",
	white: "/brand/logos/yonaris-wordmark-white.png",
} as const;

interface LogoProps extends Omit<ComponentPropsWithoutRef<"img">, "src"> {
	variant?: keyof typeof WORDMARKS;
}

export function Logo({ variant = "navy", className, alt = "Yonaris", ...props }: LogoProps) {
	return <img {...props} src={WORDMARKS[variant]} alt={alt} className={cn("h-7 w-auto object-contain", className)} />;
}
