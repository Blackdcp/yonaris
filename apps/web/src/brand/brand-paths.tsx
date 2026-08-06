import { cn } from "@workspace/ui/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export function BrandPaths({ className, ...props }: ComponentPropsWithoutRef<"svg">) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 960 960"
			preserveAspectRatio="xMidYMid slice"
			className={cn("yonaris-brand-paths", className)}
			{...props}
		>
			<defs>
				<linearGradient id="yonaris-path-fade" x1="0" x2="1" y1="0" y2="1">
					<stop offset="0" stopColor="currentColor" stopOpacity="0.04" />
					<stop offset="0.55" stopColor="currentColor" stopOpacity="0.42" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
				</linearGradient>
			</defs>

			<g fill="none" stroke="url(#yonaris-path-fade)" strokeLinecap="round">
				{Array.from({ length: 17 }, (_, index) => {
					const offset = index * 18;
					return (
						<path
							key={offset}
							d={`M ${-120 + offset} 1030 C ${80 + offset} 770, ${270 + offset} 760, ${345 + offset} 555 C ${430 + offset} 330, ${550 + offset} 360, ${790 + offset} 65`}
							strokeWidth={index % 4 === 0 ? 1.4 : 0.75}
						/>
					);
				})}
			</g>

			<g fill="none" stroke="currentColor" strokeOpacity="0.16">
				<path d="M88 742H292" />
				<circle cx="80" cy="742" r="3" fill="currentColor" stroke="none" />
				<path d="M642 248H848" />
				<circle cx="856" cy="248" r="3" fill="currentColor" stroke="none" />
			</g>

			<g stroke="var(--yonaris-signal, #ff6a00)" strokeWidth="3" strokeLinecap="round">
				<path d="M270 694v48" />
				<path d="M603 331v78" />
				<path d="M782 136v36" />
			</g>
		</svg>
	);
}
