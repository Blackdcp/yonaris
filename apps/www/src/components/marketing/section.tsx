import type { HTMLAttributes, ReactNode } from "react";

interface MarketingSectionProps extends HTMLAttributes<HTMLElement> {
	tone?: "paper" | "ink" | "mist";
	children: ReactNode;
	innerClassName?: string;
}

const tones = {
	paper: "bg-[var(--yonaris-paper)] text-[var(--yonaris-ink)]",
	ink: "bg-[var(--yonaris-ink)] text-[var(--yonaris-paper)]",
	mist: "bg-[var(--yonaris-mist)] text-[var(--yonaris-ink)]",
};

export function MarketingSection({
	tone = "paper",
	children,
	className = "",
	innerClassName = "",
	...props
}: MarketingSectionProps) {
	return (
		<section {...props} className={`${tones[tone]} ${className}`}>
			<div className={`mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12 ${innerClassName}`}>{children}</div>
		</section>
	);
}

export function SectionIntro({
	eyebrow,
	title,
	body,
	tone = "paper",
}: {
	eyebrow: string;
	title: string;
	body: string;
	tone?: "paper" | "ink";
}) {
	return (
		<div className="grid gap-7 lg:grid-cols-12 lg:gap-10">
			<p
				className={`marketing-kicker lg:col-span-3 ${tone === "ink" ? "text-[var(--yonaris-paper)]/55" : "text-[var(--yonaris-slate)]/70"}`}
			>
				{eyebrow}
			</p>
			<div className="lg:col-span-8 lg:col-start-5">
				<h2 className="marketing-display max-w-[16ch] text-[clamp(2.35rem,5vw,5.25rem)] leading-[0.98] font-medium tracking-[-0.045em] text-balance">
					{title}
				</h2>
				<p
					className={`mt-7 max-w-[46rem] text-base leading-7 sm:text-lg sm:leading-8 ${tone === "ink" ? "text-[var(--yonaris-paper)]/70" : "text-[var(--yonaris-slate)]/78"}`}
				>
					{body}
				</p>
			</div>
		</div>
	);
}
