import type { ReactNode } from "react";
import { LegacyArchiveContext } from "./legacy-archive-context";
import { SiteShell } from "./site-shell";

interface PublicationShellProps {
	section: "blog" | "glossary" | "ai-search" | "aeo-for";
	children: ReactNode;
	archiveContext?: "legacy-research";
}

const sectionLabels = {
	blog: "Blog",
	glossary: "Glossary",
	"ai-search": "AI Search archive",
	"aeo-for": "AEO archive",
} as const;

export function PublicationShell({ section, children, archiveContext }: PublicationShellProps): React.ReactNode {
	return (
		<SiteShell locale="en" mainClassName="site-publication-shell">
			<section className="site-publication-context" aria-label={sectionLabels[section]}>
				<span>{sectionLabels[section]}</span>
				<span aria-hidden="true">Publication / Yonaris</span>
			</section>
			{archiveContext ? <LegacyArchiveContext kind={archiveContext} /> : null}
			{children}
		</SiteShell>
	);
}
