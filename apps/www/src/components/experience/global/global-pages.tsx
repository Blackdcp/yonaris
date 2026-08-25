import { GLOBAL_COPY } from "@/content/experience/global-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { LeadForm } from "../shared/lead-form";
import {
	AnswerFieldScene,
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
			<section className="sf-home-opening">
				<div className="sf-home-opening__copy">
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<div className="sf-actions">
						<a className="sf-button" href={copy.primaryAction.href}>
							{copy.primaryAction.label} <span aria-hidden="true">↗</span>
						</a>
						<a className="sf-text-link" href={copy.secondaryAction.href}>
							{copy.secondaryAction.label} <span aria-hidden="true">↓</span>
						</a>
					</div>
					<div className="sf-home-opening__shift">
						<span>Start focused</span>
						<i />
						<strong>One decision-critical question</strong>
						<small>Expand by brand · market · language</small>
					</div>
				</div>
				<AnswerFieldScene />
			</section>

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

			<section className="sf-home-movement">
				<div className="sf-home-movement__intro">
					<p className="sf-kicker">What Yonaris shows</p>
					<h2>Review the answer before deciding what to change.</h2>
					<p>
						See the full response, brand and competitor mentions, available citations, and repeat checks in one
						workflow.
					</p>
					<a className="sf-text-link" href="/product">
						Explore the full product <span aria-hidden="true">→</span>
					</a>
				</div>
				<section className="sf-home-movement__steps" aria-label="Yonaris product movement">
					<article>
						<span>01</span>
						<strong>Observe</strong>
						<p>Read the complete answer for a selected buyer question.</p>
					</article>
					<article>
						<span>02</span>
						<strong>Compare</strong>
						<p>See how your brand and named alternatives appear.</p>
					</article>
					<article>
						<span>03</span>
						<strong>Review</strong>
						<p>Inspect available citations and specific information gaps.</p>
					</article>
					<article>
						<span>04</span>
						<strong>Recheck</strong>
						<p>Run the same question again and compare the result.</p>
					</article>
				</section>
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

			<section className="sf-product-question">
				<div className="sf-product-question__prompt">
					<span>Illustrative buying question</span>
					<p>“Which quality platform fits a manufacturer operating across multiple sites?”</p>
				</div>
				<div className="sf-product-question__answer">
					<div>
						<span>Brand mention</span>
						<strong>The example brand enters the shortlist</strong>
					</div>
					<div>
						<span>Description</span>
						<strong>Framed around multi-site deployment</strong>
					</div>
					<div>
						<span>Comparison</span>
						<strong>Compared on rollout and integrations</strong>
					</div>
					<div>
						<span>Available citations</span>
						<strong>Product page and buyer guide included</strong>
					</div>
				</div>
			</section>

			<section className="sf-product-decisions">
				<header>
					<p className="sf-kicker">Built for decisions</p>
					<h2>Keep the answer and the comparison in view.</h2>
				</header>
				<div className="sf-product-decisions__grid">
					<article>
						<span>Answer</span>
						<h3>What does the answer actually say?</h3>
						<p>Keep the full response visible alongside brand mentions.</p>
					</article>
					<article>
						<span>Comparison</span>
						<h3>How are you described beside alternatives?</h3>
						<p>Review category language and competitor mentions together.</p>
					</article>
					<article>
						<span>Citations</span>
						<h3>Which citations are visible?</h3>
						<p>Inspect linked sources when the AI surface provides them.</p>
					</article>
				</div>
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

			<section className="sf-approach-principle">
				<p className="sf-approach-principle__number">01</p>
				<div>
					<span>Set the scope</span>
					<h2>Choose one buyer question.</h2>
				</div>
				<p>Define the brand, market, language, and relevant alternatives.</p>
			</section>
			<section className="sf-approach-principle sf-approach-principle--dark">
				<p className="sf-approach-principle__number">02</p>
				<div>
					<span>Review what appears</span>
					<h2>Read the answer in context.</h2>
				</div>
				<p>Compare brand mentions, descriptions, competitors, and citations when available.</p>
			</section>
			<section className="sf-approach-principle sf-approach-principle--signal">
				<p className="sf-approach-principle__number">03</p>
				<div>
					<span>Choose what matters next</span>
					<h2>Turn the answer into a clear decision.</h2>
				</div>
				<p>Prioritize the description, citation, or comparison gap most relevant to the buying decision.</p>
			</section>
			<section className="sf-approach-principle sf-approach-principle--dark">
				<p className="sf-approach-principle__number">04</p>
				<div>
					<span>Recheck consistently</span>
					<h2>Compare the same question over time.</h2>
				</div>
				<p>Repeat the check with the same brand, market, language, and alternatives.</p>
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

			<section className="sf-geo-differences">
				<header>
					<p className="sf-kicker">What changes by market</p>
					<h2>The name can stay the same while the answer moves.</h2>
				</header>
				<div>
					<article>
						<span>Question</span>
						<strong>Buyers frame the need differently.</strong>
						<p>The useful prompt begins with local purchase language, not a translated keyword list.</p>
					</article>
					<article>
						<span>Context</span>
						<strong>Categories carry different expectations.</strong>
						<p>The same claim can signal leadership in one market and ambiguity in another.</p>
					</article>
					<article>
						<span>Competition</span>
						<strong>The comparison set changes.</strong>
						<p>Local incumbents and global alternatives can occupy very different positions.</p>
					</article>
				</div>
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

			<section className="sf-company-capabilities">
				<header>
					<span>How we work across markets</span>
					<h2>One brand core, understood through local buying context.</h2>
				</header>
				<div className="sf-company-capabilities__list">
					<article>
						<span>01</span>
						<h3>Start with buyer reality</h3>
						<p>Use the questions customers actually ask when comparing options.</p>
					</article>
					<article>
						<span>02</span>
						<h3>Keep the answer in context</h3>
						<p>Read the complete response, not an isolated score or mention.</p>
					</article>
					<article>
						<span>03</span>
						<h3>Respect local market language</h3>
						<p>Reframe the question for each market instead of translating it word for word.</p>
					</article>
					<article>
						<span>04</span>
						<h3>Make the next choice clearer</h3>
						<p>Identify which description, comparison, or citation deserves attention next.</p>
					</article>
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
					<span>One useful starting point</span>
					<h2>What are customers asking when your brand should be in the answer?</h2>
					<p>
						You do not need to solve the wording before contacting us. The first conversation can begin with the
						business decision behind it.
					</p>
					<ul>
						<li>
							<i /> One brand
						</li>
						<li>
							<i /> One market
						</li>
						<li>
							<i /> One buying question
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
