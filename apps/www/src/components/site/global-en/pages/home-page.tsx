import { GLOBAL_ENGLISH_CONTENT } from "@/content/site/global-en";
import { GLOBAL_ANSWER_QUESTIONS } from "@/content/site/global-en/experience";
import { GlobalEnglishShell } from "../global-english-shell";
import { AnswerStudio } from "../interactions/answer-studio";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function HomePage() {
	const content = GLOBAL_ENGLISH_CONTENT.home;

	return (
		<GlobalEnglishShell activeKey="home">
			<PageHero
				id="hero"
				eyebrow="AI MARKET EVIDENCE FOR BRANDS"
				title={content.headline}
				bridge={content.bridge}
				lead={content.description}
				visual={<AnswerStudio />}
				primaryLabel={content.primaryAction}
				secondaryHref="/product"
				secondaryLabel={content.secondaryAction}
			/>
			<PageSection
				id="operating-loop"
				number="01"
				eyebrow="THE OPERATING SYSTEM"
				title="Turn an uncertain answer into a measured next move."
				body="Observe the answer, explain the available evidence, choose one bounded action, and measure again without changing the rules."
				dark
			>
				<ol className="global-en__operating-loop" data-graphic="operating-loop">
					{[
						["Observe", "Capture the answer and its context."],
						["Explain", "Inspect the available evidence and boundary."],
						["Act", "Choose one reviewed, bounded next test."],
						["Measure", "Repeat the observation without changing the rules."],
					].map(([label, copy], index) => (
						<li key={label}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{label}</strong>
							<span>{copy}</span>
						</li>
					))}
				</ol>
			</PageSection>
			<PageSection
				id="market-shift"
				number="02"
				eyebrow="THE MARKET SHIFT"
				title="Buying journeys now pass through answers you do not control."
				body={content.problem}
			>
				<div className="global-en__signal-line" data-graphic="market-shift">
					<span>Intent forms</span>
					<i>→</i>
					<strong>AI interprets the market</strong>
					<i>→</i>
					<span>A shortlist takes shape</span>
				</div>
			</PageSection>
			<PageSection
				id="buyer-questions"
				number="03"
				eyebrow="THE QUESTIONS THAT MATTER"
				title="Start with buyer anxiety, not a dashboard metric."
				body="Yonaris organizes observation around the decisions a brand team actually needs to make. Each question stays tied to its answer, available evidence, reviewed finding, and next test."
			>
				<ol className="global-en__question-spectrum" data-graphic="buyer-question-spectrum">
					{GLOBAL_ANSWER_QUESTIONS.map((question, index) => (
						<li key={question.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{question.label}</strong>
							<span>{question.prompt}</span>
						</li>
					))}
				</ol>
			</PageSection>
			<PageSection
				id="product-preview"
				number="04"
				eyebrow="ONE CONNECTED WORKSPACE"
				title="See the system behind the observation."
				body="Four connected modules keep the buying question, answer record, evidence review, and next experiment inside one inspectable workflow."
			>
				<div className="global-en__product-preview" data-graphic="product-architecture-preview">
					{[
						["Scope", "Define the market, question, and observation rules."],
						["Answers", "Review what configured AI systems return."],
						["Evidence", "Trace what is known, missing, and comparable."],
						["Experiments", "Prioritize and follow the next bounded test."],
					].map(([name, copy], index) => (
						<article key={name}>
							<small>MODULE {String(index + 1).padStart(2, "0")}</small>
							<h3>{name}</h3>
							<p>{copy}</p>
						</article>
					))}
					<a href="/product">
						Open the product architecture <span aria-hidden="true">↗</span>
					</a>
				</div>
			</PageSection>
			<PageSection
				id="evidence-boundary"
				number="05"
				eyebrow="EVIDENCE BEFORE CONCLUSION"
				title="Every finding keeps its boundary in view."
				body="Scope, observation time, valid denominator, available evidence, unknowns, and review status stay attached to the record."
			>
				<div className="global-en__annotation" data-graphic="evidence-boundary">
					<span>DEFINED SCOPE</span>
					<strong>ANSWER RECORD</strong>
					<i>AVAILABLE EVIDENCE</i>
					<i>KNOWN UNKNOWNS</i>
					<b>REVIEW STATUS</b>
				</div>
				<a className="global-en__text-link" href="/research">
					Inspect the evidence framework →
				</a>
			</PageSection>
			<PageSection
				id="human-agent-parity"
				number="06"
				eyebrow="ONE FACTUAL SOURCE · TWO READERS"
				title="Readable by people. Addressable by agents."
				body="Human pages explain the decision. Agent pages expose the same public facts in a compact, stable structure. Neither audience receives a separate truth."
			>
				<div className="global-en__parity-map" data-graphic="human-agent-parity">
					<div>
						<small>HUMAN VIEW</small>
						<strong>Context · explanation · action</strong>
					</div>
					<i aria-hidden="true">↔</i>
					<div>
						<small>SHARED FACTS</small>
						<strong>Scope · claims · boundaries</strong>
					</div>
					<i aria-hidden="true">↔</i>
					<div>
						<small>AGENT VIEW</small>
						<strong>Stable paths · structured facts</strong>
					</div>
				</div>
				<a className="global-en__text-link" href="/agent">
					Open the Agent view →
				</a>
			</PageSection>
			<CloseSection id="request-close" title="Replace AI market anxiety with one reviewable starting point." />
		</GlobalEnglishShell>
	);
}
