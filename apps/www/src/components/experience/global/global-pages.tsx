import type { ReactNode } from "react";
import { PAGE_FACTS } from "@/content/experience/canonical-public-facts";
import { GLOBAL_COPY } from "@/content/experience/global-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { CinematicField } from "../shared/cinematic-field";
import { EvidenceSheet } from "../shared/evidence-sheet";
import { LeadForm } from "../shared/lead-form";
import {
	BuyingQuestionDossier,
	CompanyReadingScene,
	EN_READING_RECORDS,
	EvidenceReviewScene,
	HomeReadingScene,
	MarketAnswerCaseFile,
	PlatformInspectorScene,
} from "./global-scenes";
import { GlobalShell } from "./global-shell";

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a className="site-06-action" href={href}>
			{children}
		</a>
	);
}

const pageFacts = {
	product: PAGE_FACTS.en.product,
	approach: PAGE_FACTS.en.approach,
	geo: PAGE_FACTS.en.geo,
	diagnostic: PAGE_FACTS.en.diagnostic,
	privacy: PAGE_FACTS.en.privacy,
} as const;

function PublicFactMeta({ pageKey, lead }: { pageKey: keyof typeof pageFacts; lead: string }) {
	const fact = pageFacts[pageKey];
	return (
		<dl className="site-06-public-fact__meta">
			{lead !== fact.value ? (
				<div>
					<dt>Public fact</dt>
					<dd>{fact.value}</dd>
				</div>
			) : null}
			<div>
				<dt>Evidence</dt>
				<dd>{fact.source}</dd>
			</div>
			<div>
				<dt>Boundary</dt>
				<dd>{fact.boundary}</dd>
			</div>
		</dl>
	);
}

function PageLead({ pageKey, fact }: { pageKey: HumanPageKey; fact?: keyof typeof pageFacts }) {
	const copy = GLOBAL_COPY[pageKey];
	const publicFact = fact ? pageFacts[fact] : undefined;
	return (
		<article className="site-06-page-lead" id={publicFact?.id} tabIndex={publicFact ? -1 : undefined}>
			<p className="site-06-kicker">{copy.eyebrow}</p>
			<h1>{copy.title}</h1>
			<p className="site-06-hero__lead">{copy.lead}</p>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
			{fact ? <PublicFactMeta pageKey={fact} lead={copy.lead} /> : null}
		</article>
	);
}

function DarkClose({ pageKey }: { pageKey: HumanPageKey }) {
	const copy = GLOBAL_COPY[pageKey];
	return (
		<section className="site-06-dark-close">
			<div>
				<h2>{copy.closingTitle}</h2>
				<p>{copy.closingBody}</p>
			</div>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
		</section>
	);
}

export function GlobalHomePage() {
	return (
		<GlobalShell pageKey="home">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-home-composition"
				data-page-composition="cinematic-orbit"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/conference-room.jpg",
						alt: "A conference room in warm daylight",
						focalPosition: "center center",
					}}
					credit="Photo: Nastuh Abootalebi / Unsplash"
					className="site-06-home-cinematic"
				>
					<PageLead pageKey="home" />
					<HomeReadingScene />
				</CinematicField>

				<section className="site-06-section site-06-home-dossier">
					<header className="site-06-split-intro">
						<h2>The shortlist now forms before the click.</h2>
						<p>
							Traditional MarTech begins with exposure, visits and leads. Yonaris starts earlier: with the question, the
							evidence an agent can find and the comparison a buyer may inherit.
						</p>
					</header>
					<BuyingQuestionDossier />
				</section>

				<section className="site-06-home-workbench">
					<div className="site-06-section">
						<MarketAnswerCaseFile />
					</div>
				</section>

				<CinematicField
					image={{
						src: "/brand/site-06/glass-venue.jpg",
						alt: "People moving through a large glass business venue",
						focalPosition: "center center",
					}}
					credit="Photo: Zerrin Velizade / Pexels"
					className="site-06-home-comparison-photo"
				>
					<header className="site-06-page-lead">
						<h2>Keep the question, evidence and retest together.</h2>
						<p className="site-06-hero__lead">
							A review preserves the original buying question, the answer and sources observed at the time, the change
							made, and the retest under comparable conditions.
						</p>
					</header>
					<EvidenceReviewScene />
				</CinematicField>

				<section className="site-06-section site-06-home-bridge">
					<header className="site-06-split-intro">
						<h2>One public truth. Two ways to read it.</h2>
						<p>
							People need context and judgment. Agents need explicit facts, evidence and boundaries. The public material
							should serve both without creating two competing versions of the company.
						</p>
					</header>
					<blockquote>{EN_READING_RECORDS[0]?.fact}</blockquote>
					<aside>Category, purpose, source and scope stay canonical. Only the reading structure changes.</aside>
					<ActionLink href="/company">Open the dual reading</ActionLink>
				</section>

				<DarkClose pageKey="home" />
			</div>
		</GlobalShell>
	);
}

export function GlobalProductPage() {
	return (
		<GlobalShell pageKey="product">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-product-composition"
				data-page-composition="evidence-workbench"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/conference-room.jpg",
						alt: "A meeting room in warm daylight",
						focalPosition: "center center",
					}}
					credit="Photo: Nastuh Abootalebi / Unsplash"
					className="site-06-product-cinematic"
				>
					<PageLead pageKey="product" fact="product" />
					<EvidenceSheet
						label="Answer dossier · Illustrative structure"
						annotation={
							<span>
								Source type · company capability record
								<br />
								Owner · public company material
								<br />
								Scope · named market condition
								<br />
								Review date · 27 Aug 2026
							</span>
						}
					>
						<p>Which company can support this decision without adding risk?</p>
						<p className="site-06-evidence-sheet__support">
							The answer gives weight to fit with the operating conditions, evidence a buying team can review, and a
							delivery boundary that remains explicit.
						</p>
					</EvidenceSheet>
				</CinematicField>

				<section className="site-06-section site-06-product-trace">
					<PlatformInspectorScene />
				</section>

				<DarkClose pageKey="product" />
			</div>
		</GlobalShell>
	);
}

export function GlobalApproachPage() {
	return (
		<GlobalShell pageKey="approach">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-approach-composition"
				data-page-composition="comparison-field"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/business-walk.jpg",
						alt: "Two business people walking outside a modern workplace",
						focalPosition: "center 72%",
					}}
					credit="Photo: Mikhail Nilov / Pexels"
					className="site-06-approach-cinematic"
				>
					<PageLead pageKey="approach" fact="approach" />
					<aside className="site-06-same-question-preview" aria-label="Baseline and retest evidence preview">
						<p className="site-06-kicker">Same buying question</p>
						<blockquote>What changed in the answer—and what evidence caused the change?</blockquote>
						<p data-review-state="baseline">
							<strong>Baseline</strong> Capability is visible; the buying condition is unsupported.
						</p>
						<p data-review-state="retest">
							<strong>Retest</strong> The new source states the condition, scope and review date.
						</p>
					</aside>
				</CinematicField>

				<section className="site-06-approach-stage">
					<div className="site-06-section">
						<EvidenceReviewScene preview />
					</div>
				</section>

				<section className="site-06-section site-06-editorial-close">
					<h2>{GLOBAL_COPY.approach.closingTitle}</h2>
					<p>{GLOBAL_COPY.approach.closingBody}</p>
				</section>
			</div>
		</GlobalShell>
	);
}

export function GlobalCompanyPage() {
	return (
		<GlobalShell pageKey="company">
			<div className="site-06-page-composition site-06-company-composition" data-page-composition="dual-reading-field">
				<section className="site-06-company-field">
					<header className="site-06-company-intro">
						<p className="site-06-kicker">{GLOBAL_COPY.company.eyebrow}</p>
						<h1>{GLOBAL_COPY.company.title}</h1>
						<p className="site-06-hero__lead">{GLOBAL_COPY.company.lead}</p>
					</header>
					<CompanyReadingScene />
				</section>

				<section className="site-06-section site-06-company-document">
					<header className="site-06-split-intro">
						<h2>Machine-readable does not mean machine-written.</h2>
						<p>
							Clear headings, stable addresses, visible sources, scoped facts and consistent public records help
							retrieval. They do not guarantee ranking, inclusion, retrieval or citation.
						</p>
					</header>
					<p className="site-06-company-document__statement">
						People receive context for a decision. Agents receive the same facts with evidence, scope and a stable
						relationship to the rest of the company record.
					</p>
					<ActionLink href="/agent/company">Read the corresponding Agent record</ActionLink>
				</section>
			</div>
		</GlobalShell>
	);
}

export function GlobalGeoPage() {
	return (
		<GlobalShell pageKey="geo" tone="paper">
			<div className="site-06-page-composition site-06-market-composition" data-page-composition="market-editorial">
				<section className="site-06-market-editorial">
					<PageLead pageKey="geo" fact="geo" />
					<figure className="site-06-editorial-photo">
						<img src="/brand/site-06/glass-meeting.jpg" alt="A business conversation in a glass meeting room" />
						<figcaption>Photo: Andrea Piacquadio / Pexels</figcaption>
					</figure>
				</section>

				<section className="site-06-section site-06-market-ledger" aria-label="Market conditions record">
					<header>
						<p className="site-06-kicker">One decision, read in its actual context</p>
						<h2>Context is part of the evidence record.</h2>
					</header>
					<dl>
						<div>
							<dt>Market</dt>
							<dd>The commercial context surrounding the choice.</dd>
						</div>
						<div>
							<dt>Language</dt>
							<dd>The words a buyer uses to describe the need.</dd>
						</div>
						<div>
							<dt>Buying context</dt>
							<dd>The condition that determines what a suitable answer must support.</dd>
						</div>
						<div>
							<dt>Alternatives</dt>
							<dd>The options considered under the same question.</dd>
						</div>
						<div>
							<dt>Evidence</dt>
							<dd>The sources, scope, review date and boundaries available for inspection.</dd>
						</div>
					</dl>
				</section>

				<DarkClose pageKey="geo" />
			</div>
		</GlobalShell>
	);
}

export function GlobalDiagnosticPage() {
	return (
		<GlobalShell pageKey="diagnostic">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-diagnostic-composition"
				data-page-composition="contact-cinematic"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/glass-venue.jpg",
						alt: "People moving through a large glass business venue",
						focalPosition: "center center",
					}}
					credit="Photo: Zerrin Velizade / Pexels"
					className="site-06-contact-cinematic"
				>
					<PageLead pageKey="diagnostic" fact="diagnostic" />
					<div id="contact-form" className="site-06-contact-form">
						<LeadForm locale="en" compact />
					</div>
				</CinematicField>
			</div>
		</GlobalShell>
	);
}

export function GlobalPrivacyPage() {
	return (
		<GlobalShell pageKey="privacy" tone="paper">
			<div className="site-06-page-composition site-06-privacy-composition" data-page-composition="privacy-editorial">
				<article className="site-06-privacy-document" id={pageFacts.privacy.id} tabIndex={-1}>
					<header className="site-06-privacy-document__header">
						<p className="site-06-kicker">{GLOBAL_COPY.privacy.eyebrow}</p>
						<h1>{GLOBAL_COPY.privacy.title}</h1>
						<p className="site-06-hero__lead">{GLOBAL_COPY.privacy.lead}</p>
						<PublicFactMeta pageKey="privacy" lead={GLOBAL_COPY.privacy.lead} />
					</header>
					<section>
						<h2>Three visible details</h2>
						<p>Name, work email and company are the only visible fields required for an English contact request.</p>
					</section>
					<section>
						<h2>Your details stay with this request.</h2>
						<p>
							We use your details to understand and respond to the request. If it cannot be completed, the page keeps
							your entries so you can try again. Browser analytics do not receive the form values.
						</p>
					</section>
					<section>
						<h2>A short return route</h2>
						<p>No long questionnaire or prepared report is required before the first conversation.</p>
						<ActionLink href="/diagnostic">Return to contact</ActionLink>
					</section>
				</article>
			</div>
		</GlobalShell>
	);
}

export const GLOBAL_PAGES = {
	home: GlobalHomePage,
	product: GlobalProductPage,
	approach: GlobalApproachPage,
	geo: GlobalGeoPage,
	company: GlobalCompanyPage,
	diagnostic: GlobalDiagnosticPage,
	privacy: GlobalPrivacyPage,
} as const satisfies Record<HumanPageKey, () => ReactNode>;
