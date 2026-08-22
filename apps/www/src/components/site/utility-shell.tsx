import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";

interface UtilityShellProps {
	section: "docs" | "status" | "brand" | "changelog" | "roadmap" | "open-source";
	children: ReactNode;
}

const sectionLabels = {
	docs: "Open-source Documentation",
	status: "Operational Status",
	brand: "Brand resources",
	changelog: "Open-source changelog",
	roadmap: "Open-source roadmap",
	"open-source": "Open-source infrastructure",
} as const;

export function UtilityShell({ section, children }: UtilityShellProps): React.ReactNode {
	return (
		<SiteShell locale="en" mainClassName="site-utility-shell">
			<div className="site-utility-context">{sectionLabels[section]}</div>
			{children}
		</SiteShell>
	);
}
