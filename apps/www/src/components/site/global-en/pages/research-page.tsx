import { GlobalEnglishShell } from "../global-english-shell";
import { EvidenceExplorer } from "../interactions/evidence-explorer";
import { EvidenceLedger } from "../visuals/visuals";
import { PageHero, PageSection } from "./page-primitives";

export function ResearchPage() {
	return (
		<GlobalEnglishShell activeKey="research">
			<PageHero
				id="ledger-hero"
				eyebrow="EVIDENCE"
				title="Evidence needs a scope, denominator, and boundary."
				lead="A measurement is useful when a reader can inspect what was observed, what counted, and what remains unknown."
				visual={<EvidenceLedger />}
				dark
				secondaryHref="/approach"
				secondaryLabel="See how it works"
			/>
			<PageSection
				id="metric-anatomy"
				number="01"
				title="The denominator is part of the claim."
				body="Mention rate means valid answer samples mentioning the target brand divided by all valid samples in the defined scope."
			>
				<EvidenceExplorer />
			</PageSection>
			<PageSection
				id="cohort-comparison"
				number="02"
				title="A changed cohort can change the meaning."
				body="Market, language, question set, surface, and observation period must remain visible beside any comparison."
			>
				<div className="global-en__cohorts" data-graphic="cohort-comparison">
					<div>
						<small>COHORT A</small>
						<b>Definition only</b>
						<span>No observation loaded</span>
					</div>
					<i>≠</i>
					<div>
						<small>COHORT B</small>
						<b>Definition only</b>
						<span>No observation loaded</span>
					</div>
				</div>
			</PageSection>
			<PageSection
				id="answer-annotation"
				number="03"
				title="Separate the answer, its evidence, and the finding."
				body="An answer excerpt is a record. Available sources are evidence states. A finding is a bounded human interpretation."
			>
				<div className="global-en__annotation" data-graphic="answer-annotation">
					<span>ANSWER · No observation loaded</span>
					<span>EVIDENCE · Not applicable</span>
					<span>FINDING · Awaiting review</span>
				</div>
			</PageSection>
			<PageSection
				id="limits-and-request-close"
				number="04"
				title="Know the limits before making the decision."
				body="Configured sampling is not universal coverage, a repeat observation is not causal proof, and unavailable evidence is recorded as unknown—not guessed."
			>
				<a className="global-en__button" href="/diagnostic">
					Request a diagnostic
				</a>
			</PageSection>
		</GlobalEnglishShell>
	);
}
