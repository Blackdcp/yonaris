import { GlobalEnglishShell } from "../global-english-shell";
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
				id="four-step-path"
				number="01"
				title="One path. Four explicit decisions."
				body="Define conditions, collect comparable answer samples, inspect available evidence, then choose a bounded next test."
			>
				<EvidencePath />
			</PageSection>
			<PageSection
				id="step-artifacts"
				number="02"
				title="Each step leaves an artifact someone can review."
				body="Inputs, outputs, ownership, and the review question travel together."
			>
				<div className="global-en__artifact-grid" data-graphic="step-artifacts">
					{[
						["Scope brief", "Is the question specific enough?"],
						["Answer set", "Are the samples comparable?"],
						["Evidence note", "What is known and unknown?"],
						["Test brief", "Who approves the next observation?"],
					].map(([a, q], i) => (
						<article key={a}>
							<em>0{i + 1}</em>
							<h3>{a}</h3>
							<p>{q}</p>
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
