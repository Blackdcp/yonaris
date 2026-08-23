import type { ReactNode } from "react";
import { LegacyArchiveContext } from "./legacy-archive-context";
import { SiteShell } from "./site-shell";

export function LegacyArchiveShell({ children }: { children: ReactNode }): React.ReactNode {
	return (
		<SiteShell locale="en" mainClassName="legacy-archive-shell">
			<section className="legacy-archive-register" aria-label="Archive register">
				<span>Market reference / upstream record</span>
				<span aria-hidden="true">Yonaris / Archive</span>
			</section>
			<LegacyArchiveContext kind="upstream-comparison" />
			{children}
		</SiteShell>
	);
}
