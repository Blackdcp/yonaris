import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function DirectoryBackLink({ label = "AI Visibility Tool Directory" }: { label?: string }) {
	return (
		<div className="legacy-archive-back">
			<Link className="legacy-archive-link" to="/ai-visibility-tools">
				← {label}
			</Link>
		</div>
	);
}

export function DirectoryHero({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
	return (
		<header className="legacy-archive-hero">
			<div>
				<p className="legacy-archive-kicker">{eyebrow}</p>
				<h1 className="legacy-archive-title">{title}</h1>
				<p className="legacy-archive-lead">{lead}</p>
			</div>
			<p className="legacy-archive-note">
				Historical market record / supplier claims and feature coverage may have changed since publication.
			</p>
		</header>
	);
}

export function DirectoryElmoBanner({
	pitch,
	comparison,
}: {
	pitch: string;
	comparison: { slug: string; name: string };
}) {
	return (
		<section className="legacy-archive-section" aria-labelledby={`archive-elmo-note-${comparison.slug}`}>
			<p className="legacy-archive-kicker">Upstream Elmo note</p>
			<h2 className="legacy-archive-section__heading" id={`archive-elmo-note-${comparison.slug}`}>
				Historical open-source reference
			</h2>
			<div className="legacy-archive-copy">
				<p>{pitch}</p>
				<p>
					This text belongs to the upstream Elmo comparison archive. It is preserved as provenance for the archived
					comparison with {comparison.name}.
				</p>
			</div>
		</section>
	);
}

export function ElmoCta() {
	return (
		<section className="legacy-archive-section" aria-labelledby="legacy-archive-endpoint">
			<p className="legacy-archive-kicker">End of archived record</p>
			<h2 className="legacy-archive-section__heading" id="legacy-archive-endpoint">
				Continue in the current Yonaris scope
			</h2>
			<nav
				aria-label="Continue in current Yonaris scope"
				className="legacy-archive-current-scope"
				data-legacy-current-scope
			>
				<Link className="legacy-archive-link" to="/product">
					Current product
				</Link>
				<Link className="legacy-archive-link" to="/geo">
					Current GEO work
				</Link>
				<Link className="legacy-archive-link" to="/open-source">
					Open source
				</Link>
			</nav>
		</section>
	);
}

export function DirectorySection({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<section className="legacy-archive-section">
			{title ? <h2 className="legacy-archive-section__heading">{title}</h2> : null}
			{children}
		</section>
	);
}
