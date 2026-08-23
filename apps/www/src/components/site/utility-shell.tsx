import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";

interface UtilityShellProps {
	section: "status" | "brand";
	children: ReactNode;
}

const sectionLabels = {
	status: "Operational checks",
	brand: "Brand resources",
} as const;

export function UtilityShell({ section, children }: UtilityShellProps): React.ReactNode {
	return (
		<SiteShell locale="en" mainClassName="site-utility-shell">
			<section className="site-utility-context" aria-label={sectionLabels[section]}>
				<span>{sectionLabels[section]}</span>
				<span aria-hidden="true">Utility / Yonaris</span>
			</section>
			{children}
		</SiteShell>
	);
}
