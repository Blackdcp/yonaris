import { GLOBAL_COPY } from "@/content/experience/global-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { LeadForm } from "../shared/lead-form";
import { GlobalHomeReview } from "./global-home-review";
import {
	ChangePathScene,
	CompanyConstellationScene,
	ContactSignalScene,
	DataRouteScene,
	MarketAtlasScene,
	ProductLensScene,
} from "./global-scenes";
import { GlobalShell } from "./global-shell";
import "../../../styles/experience/global.css";

const homeSituations = [
	{
		number: "01",
		title: "Missing from the shortlist",
		body: "The buyer asks. Your category appears. Your brand does not.",
	},
	{
		number: "02",
		title: "Described on someone else’s terms",
		body: "The answer mentions you, but the distinction your market should remember is gone.",
	},
	{
		number: "03",
		title: "Outflanked in the comparison",
		body: "Competitors become the default reference before a buyer sees your own story.",
	},
	{
		number: "04",
		title: "Fragmented across markets",
		body: "The same brand is framed differently when language, context, and alternatives change.",
	},
	{
		number: "05",
		title: "Unsure what to review",
		body: "There is plenty to inspect, but no clear view of which brand issue deserves attention first.",
	},
] as const;

export function GlobalHomePage() {
	const copy = GLOBAL_COPY.home;
	return (
		<GlobalShell pageKey="home" scene="answer-field">
			<GlobalHomeReview />

			<section className="sf-situation-chapter">
				<header>
					<p className="sf-kicker">Questions worth checking</p>
					<h2>Is your brand present, accurate, competitive, and consistent?</h2>
					<p>Five situations that can change how a customer understands your brand.</p>
				</header>
				<div className="sf-situation-rail">
					{homeSituations.map((situation) => (
						<article key={situation.number} data-situation={situation.number}>
							<span>{situation.number}</span>
							<h3>{situation.title}</h3>
							<p>{situation.body}</p>
						</article>
					))}
				</div>
			</section>

			<section className="sf-home-world">
				<div className="sf-home-world__graphic" aria-hidden="true">
					<span className="sf-home-world__node sf-home-world__node--1">EN</span>
					<span className="sf-home-world__node sf-home-world__node--2">ZH</span>
					<span className="sf-home-world__node sf-home-world__node--3">LOCAL</span>
					<i />
					<i />
					<i />
				</div>
				<div>
					<p className="sf-kicker">Global brand, local answer</p>
					<h2>Your story travels. The buyer’s question changes.</h2>
					<p>
						Yonaris helps rebuild the question for each target market, so the brand stays coherent without sounding
						copied from somewhere else.
					</p>
					<a className="sf-button sf-button--ghost" href="/geo">
						Explore global markets <span aria-hidden="true">↗</span>
					</a>
				</div>
			</section>

			<section className="sf-home-contact">
				<div className="sf-home-contact__statement">
					<span>Start here</span>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<LeadForm locale="en" compact />
			</section>
		</GlobalShell>
	);
}

export function GlobalProductPage() {
	const copy = GLOBAL_COPY.product;
	return (
		<GlobalShell pageKey="product" scene="product-lens">
			<section className="sf-product-opening">
				<header>
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<div className="sf-actions">
						<a className="sf-button" href={copy.primaryAction.href}>
							{copy.primaryAction.label} <span aria-hidden="true">↗</span>
						</a>
						<a className="sf-text-link" href={copy.secondaryAction.href}>
							{copy.secondaryAction.label} <span aria-hidden="true">→</span>
						</a>
					</div>
				</header>
				<ProductLensScene />
			</section>

			<section className="sf-product-record-boundary">
				<span>One record, one controlled scope</span>
				<p>
					This illustrative walkthrough keeps the input, evidence, decision, and next action together at every stage. It
					does not substitute an unexplained score for the complete answer.
				</p>
			</section>

			<section className="sf-page-close sf-page-close--product">
				<div>
					<p className="sf-kicker">Next question</p>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<a className="sf-button" href="/diagnostic">
					Start the conversation <span aria-hidden="true">↗</span>
				</a>
			</section>
		</GlobalShell>
	);
}

export function GlobalApproachPage() {
	const copy = GLOBAL_COPY.approach;
	return (
		<GlobalShell pageKey="approach" scene="change-path">
			<section className="sf-approach-opening">
				<div className="sf-approach-opening__copy">
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<a className="sf-button" href={copy.primaryAction.href}>
						{copy.primaryAction.label} <span aria-hidden="true">↗</span>
					</a>
				</div>
				<ChangePathScene />
			</section>

			<section className="sf-approach-handoff" aria-labelledby="approach-handoff-title">
				<header>
					<p className="sf-kicker">Review handoff</p>
					<h2 id="approach-handoff-title">A record another team member can inspect.</h2>
				</header>
				<dl>
					<div>
						<dt>Scope held constant</dt>
						<dd>The same brand, market, language, question, and alternative set stays visible.</dd>
					</div>
					<div>
						<dt>Evidence kept in context</dt>
						<dd>The complete answer and visible citation labels stay beside the selected review item.</dd>
					</div>
					<div>
						<dt>Next action named</dt>
						<dd>The record distinguishes a specific review item from the team action that follows it.</dd>
					</div>
				</dl>
			</section>

			<section className="sf-page-close sf-page-close--approach">
				<div>
					<p className="sf-kicker">A focused next move</p>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<a className="sf-button" href="/diagnostic">
					Discuss your priority question <span aria-hidden="true">↗</span>
				</a>
			</section>
		</GlobalShell>
	);
}

export function GlobalGeoPage() {
	const copy = GLOBAL_COPY.geo;
	return (
		<GlobalShell pageKey="geo" scene="market-atlas">
			<section className="sf-geo-opening">
				<header>
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<div className="sf-actions">
						<a className="sf-button" href={copy.primaryAction.href}>
							{copy.primaryAction.label} <span aria-hidden="true">↗</span>
						</a>
						<a className="sf-text-link" href={copy.secondaryAction.href}>
							{copy.secondaryAction.label} <span aria-hidden="true">→</span>
						</a>
					</div>
				</header>
				<MarketAtlasScene />
			</section>

			<section className="sf-geo-bridge">
				<div className="sf-geo-bridge__origin">
					<span>One brand core</span>
					<strong>What must remain recognisable</strong>
				</div>
				<div className="sf-geo-bridge__lines" aria-hidden="true">
					<i />
					<i />
					<i />
				</div>
				<div className="sf-geo-bridge__markets">
					<div>
						<span>Language</span>
						<strong>Buyer wording</strong>
					</div>
					<div>
						<span>Category</span>
						<strong>Local terms</strong>
					</div>
					<div>
						<span>Alternatives</span>
						<strong>Relevant competitors</strong>
					</div>
				</div>
			</section>

			<section className="sf-page-close sf-page-close--geo">
				<div>
					<p className="sf-kicker">Global capability</p>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<a className="sf-button" href="/diagnostic">
					Discuss a target market <span aria-hidden="true">↗</span>
				</a>
			</section>
		</GlobalShell>
	);
}

export function GlobalCompanyPage() {
	const copy = GLOBAL_COPY.company;
	return (
		<GlobalShell pageKey="company" scene="company-constellation">
			<section className="sf-company-opening">
				<div className="sf-company-opening__copy">
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<div className="sf-actions">
						<a className="sf-button" href={copy.primaryAction.href}>
							{copy.primaryAction.label} <span aria-hidden="true">↗</span>
						</a>
						<a className="sf-text-link" href={copy.secondaryAction.href}>
							{copy.secondaryAction.label} <span aria-hidden="true">→</span>
						</a>
					</div>
				</div>
				<CompanyConstellationScene />
			</section>

			<section className="sf-company-belief">
				<p className="sf-kicker">Why Yonaris exists</p>
				<blockquote>Customers are asking AI before many brands know what the answer says.</blockquote>
				<div>
					<p>
						Yonaris helps teams see how their brand is presented at the moment a customer is discovering, comparing, or
						choosing.
					</p>
					<p>
						We work from buyer questions and complete answers, keeping the market context visible so the next decision
						is grounded in what customers can actually encounter.
					</p>
				</div>
			</section>

			<section className="sf-page-close sf-page-close--company">
				<div>
					<p className="sf-kicker">What comes together</p>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<a className="sf-button" href="/diagnostic">
					Talk to Yonaris <span aria-hidden="true">↗</span>
				</a>
			</section>
		</GlobalShell>
	);
}

export function GlobalDiagnosticPage() {
	const copy = GLOBAL_COPY.diagnostic;
	return (
		<GlobalShell pageKey="diagnostic" scene="contact-signal">
			<section className="sf-contact-opening">
				<header>
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<a className="sf-text-link" href={copy.secondaryAction.href}>
						{copy.secondaryAction.label} <span aria-hidden="true">→</span>
					</a>
				</header>
				<ContactSignalScene />
			</section>

			<section className="sf-contact-form-section" id="contact-form">
				<div className="sf-contact-form-section__aside">
					<span>The first conversation determines</span>
					<h2>The smallest useful scope for a focused AI-answer review.</h2>
					<p>
						No prepared report is required. Bring the business decision; together we can define the brand, market,
						language, buyer question, and supplied alternatives worth reviewing.
					</p>
					<ul>
						<li>
							<i /> Brand and target market
						</li>
						<li>
							<i /> Language and buying context
						</li>
						<li>
							<i /> Buyer question and supplied alternatives
						</li>
					</ul>
				</div>
				<LeadForm locale="en" />
			</section>
			<section className="sf-contact-shortcut">
				<span>A simple start</span>
				<strong>One question is enough.</strong>
				<p>{copy.closingBody}</p>
			</section>
		</GlobalShell>
	);
}

export function GlobalPrivacyPage() {
	const copy = GLOBAL_COPY.privacy;
	return (
		<GlobalShell pageKey="privacy" scene="data-route">
			<section className="sf-privacy-opening">
				<div>
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<a className="sf-button" href={copy.primaryAction.href}>
						{copy.primaryAction.label} <span aria-hidden="true">↗</span>
					</a>
				</div>
				<DataRouteScene />
			</section>

			<section className="sf-privacy-details">
				<article>
					<span>01 / What you send</span>
					<h2>Three visible contact fields.</h2>
					<p>The global form sends the name, work email, and company you enter.</p>
				</article>
				<article>
					<span>02 / Why we use it</span>
					<h2>To receive and respond to your request.</h2>
					<p>Yonaris uses these details to understand the enquiry and contact you.</p>
				</article>
				<article>
					<span>03 / Browser analytics</span>
					<h2>Your form values stay out of browser analytics.</h2>
					<p>The values you enter are not used for website analytics or placed in the page URL.</p>
				</article>
				<article>
					<span>04 / Abuse protection</span>
					<h2>Automated protection helps limit repeated requests.</h2>
					<p>Connection information may be processed briefly to reduce automated abuse.</p>
				</article>
			</section>

			<section className="sf-privacy-contact">
				<div>
					<span>Questions</span>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
				</div>
				<a className="sf-button sf-button--ghost" href="/diagnostic">
					Contact Yonaris <span aria-hidden="true">↗</span>
				</a>
			</section>
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
} satisfies Record<HumanPageKey, () => React.ReactNode>;
