import { GLOBAL_EVIDENCE_JOURNEY } from "@/content/site/global-en/experience";
import { GlobalEnglishShell } from "../global-english-shell";
import { EvidenceJourney } from "../interactions/evidence-journey";
import { EvidencePath } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function ApproachPage() {
	return (
		<GlobalEnglishShell activeKey="approach">
			<PageHero
				id="premise-hero"
				eyebrow="HOW IT WORKS"
				title="Move from uncertainty to a reviewable next test."
				lead="One defined market question moves through observation, evidence inspection, human review, and a repeatable comparison boundary."
				visual={<EvidencePath />}
			/>
			<PageSection
				id="evidence-journey"
				number="01"
				eyebrow="A REVIEWABLE METHOD"
				title="One journey. Four explicit decisions."
				body="Define the conditions, observe comparable answers, inspect available evidence, then decide which bounded test deserves ownership."
			>
				<EvidenceJourney />
			</PageSection>
			<PageSection
				id="review-artifacts"
				number="02"
				title="Each step leaves an artifact someone can review."
				body="Inputs, outputs, ownership, and the review question travel together."
			>
				<div className="global-en__artifact-grid" data-graphic="review-artifacts">
					{GLOBAL_EVIDENCE_JOURNEY.map((step, i) => (
						<article key={step.id}>
							<em>0{i + 1}</em>
							<h3>{step.artifact}</h3>
							<p>{step.reviewQuestion}</p>
						</article>
					))}
				</div>
			</PageSection>
			<PageSection
				id="repeat-observation-boundary"
				number="03"
				title="Repeat observation is comparison—not proof of causality."
				body="The same defined conditions can show a change. They cannot prove that one intervention caused it without a suitable study design."
				dark
			>
				<div className="global-en__loop" data-graphic="repeat-boundary">
					<span>Defined baseline</span>
					<i>→</i>
					<span>Reviewed test</span>
					<i>→</i>
					<span>Same-scope observation</span>
					<b>STOP: human decision</b>
				</div>
			</PageSection>
			<CloseSection id="request-close" title="Start with the market question you cannot currently answer." />
		</GlobalEnglishShell>
	);
}
