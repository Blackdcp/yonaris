import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface MarketingLinkProps {
	href: string;
	children: ReactNode;
	variant?: "primary" | "outline" | "text";
	tone?: "ink" | "paper";
	className?: string;
	showArrow?: boolean;
}

const variants = {
	primary:
		"border-[var(--yonaris-signal)] bg-[var(--yonaris-signal)] text-[var(--yonaris-ink)] hover:border-[var(--yonaris-paper)] hover:bg-[var(--yonaris-paper)] hover:text-[var(--yonaris-ink)]",
	outline: "border-current bg-transparent hover:border-[var(--yonaris-signal)] hover:text-[var(--yonaris-signal)]",
	text: "border-transparent bg-transparent px-0 hover:text-[var(--yonaris-signal)]",
};

export function MarketingLink({
	href,
	children,
	variant = "primary",
	tone = "ink",
	className = "",
	showArrow = true,
}: MarketingLinkProps) {
	return (
		<Link
			to={href}
			className={`group inline-flex min-h-11 items-center justify-center gap-3 border px-4 text-xs font-medium tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yonaris-signal)] focus-visible:ring-offset-3 ${tone === "ink" ? "focus-visible:ring-offset-[var(--yonaris-ink)]" : "focus-visible:ring-offset-[var(--yonaris-paper)]"} ${variants[variant]} ${className}`}
		>
			<span>{children}</span>
			{showArrow ? (
				<svg
					aria-hidden="true"
					viewBox="0 0 16 16"
					fill="none"
					className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
				>
					<path
						d="M4 12 12 4M6.5 4H12v5.5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="square"
						strokeLinejoin="miter"
					/>
				</svg>
			) : null}
		</Link>
	);
}
