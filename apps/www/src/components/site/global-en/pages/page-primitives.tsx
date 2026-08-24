import type { ReactNode } from "react";

export function PageHero({
	id,
	eyebrow,
	title,
	lead,
	bridge,
	visual,
	dark = false,
	primaryLabel = "Request a diagnostic",
	secondaryHref = "/research",
	secondaryLabel = "See the evidence",
}: {
	id: string;
	eyebrow: string;
	title: string;
	lead: string;
	bridge?: string;
	visual: ReactNode;
	dark?: boolean;
	primaryLabel?: string;
	secondaryHref?: string;
	secondaryLabel?: string;
}) {
	return (
		<section id={id} className={`global-en__hero${dark ? " global-en__band--dark" : ""}`}>
			<div className="global-en__hero-copy">
				<p className="global-en__eyebrow">{eyebrow}</p>
				<h1>{title}</h1>
				{bridge && <p className="global-en__hero-bridge">{bridge}</p>}
				<p className="global-en__lead">{lead}</p>
				<div className="global-en__actions">
					<a className="global-en__button" href="/diagnostic">
						{primaryLabel}
					</a>
					<a className="global-en__text-link" href={secondaryHref}>
						{secondaryLabel} <span aria-hidden="true">↘</span>
					</a>
				</div>
			</div>
			{visual}
		</section>
	);
}

export function PageSection({
	id,
	number,
	eyebrow,
	title,
	body,
	children,
	dark = false,
}: {
	id: string;
	number: string;
	eyebrow?: string;
	title: string;
	body: string;
	children?: ReactNode;
	dark?: boolean;
}) {
	return (
		<section id={id} className={`global-en__section${dark ? " global-en__band--dark" : ""}`}>
			<div className="global-en__section-head">
				<span className="global-en__section-number">{number}</span>
				<div>
					{eyebrow && <p className="global-en__eyebrow">{eyebrow}</p>}
					<h2>{title}</h2>
					<p>{body}</p>
				</div>
			</div>
			{children}
		</section>
	);
}

export function CloseSection({
	id,
	title,
	body = "Bring one brand, one market, and one question that matters. We will review the scope before any observation begins.",
}: {
	id: string;
	title: string;
	body?: string;
}) {
	return (
		<section id={id} className="global-en__close">
			<p className="global-en__eyebrow">NEXT STEP</p>
			<h2>{title}</h2>
			<p>{body}</p>
			<a className="global-en__button" href="/diagnostic">
				Request a diagnostic
			</a>
		</section>
	);
}
