import { GlobalEnglishShell } from "../global-english-shell";
import { EvidencePath, EvidenceWindow, ResponsibilityLanes } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function HomePage() {
	return (
		<GlobalEnglishShell activeKey="home">
			<PageHero
				id="hero"
				eyebrow="AI MARKET EVIDENCE FOR BRANDS"
				title="Know how AI represents your brand—and what to do next."
				lead="Yonaris shows how configured AI systems describe and compare your brand, which available sources appear behind the answers, and which next test deserves attention."
				visual={<EvidenceWindow />}
				secondaryHref="#sample"
				secondaryLabel="See a sample"
			/>
			<PageSection
				id="what-changed"
				number="01"
				eyebrow="THE UNCERTAINTY"
				title="AI is changing how markets discover and compare."
				body="Your market may already be learning from AI answers. The problem is not a lack of advice; it is not being able to see the answer, its context, or the evidence boundary."
			>
				<div className="global-en__signal-line" data-graphic="market-shift">
					<span>Search</span>
					<i>→</i>
					<strong>AI-mediated discovery</strong>
					<i>→</i>
					<span>Choice</span>
				</div>
			</PageSection>
			<PageSection
				id="visible-outputs"
				number="02"
				title="Four outputs turn uncertainty into a reviewable question."
				body="See the answer sample, the comparison context, the available sources, and the next-test candidate without pretending that one score explains the market."
			>
				<div className="global-en__output-stack" data-graphic="output-stack">
					{["Answer sample", "Comparison context", "Available sources", "Reviewed next test"].map((item, i) => (
						<article key={item}>
							<em>0{i + 1}</em>
							<h3>{item}</h3>
							<p>
								{i === 0
									? "What the configured system said."
									: i === 1
										? "How the defined cohort changes meaning."
										: i === 2
											? "What evidence the surface exposes."
											: "What deserves a bounded follow-up."}
							</p>
						</article>
					))}
				</div>
			</PageSection>
			<PageSection
				id="evidence-path"
				number="03"
				eyebrow="ONE EVIDENCE PATH"
				title="Follow the claim back to what can be inspected."
				body="A defined question moves through answer, evidence, finding, and a reviewed next test."
			>
				<div id="sample">
					<EvidencePath />
				</div>
			</PageSection>
			<PageSection
				id="delivery-model"
				number="04"
				title="Software you can inspect. Collection and review we operate with you."
				body="The workspace keeps answer records visible. Yonaris operates configured collection and human review where the workflow is not self-service."
			>
				<ResponsibilityLanes />
			</PageSection>
			<PageSection
				id="evidence-preview"
				number="05"
				title="Evidence is useful only when its boundary is visible."
				body="Every record reserves space for scope, time, valid denominator, known evidence, unknown evidence, and review status."
			>
				<div className="global-en__annotation" data-graphic="evidence-preview">
					<span>DEFINED SCOPE</span>
					<strong>Answer record</strong>
					<i>Known evidence</i>
					<i>Unknown state</i>
					<b>Human review</b>
				</div>
				<a className="global-en__text-link" href="/research">
					Inspect the evidence framework →
				</a>
			</PageSection>
			<CloseSection id="request-close" title="Replace AI market anxiety with one reviewable starting point." />
		</GlobalEnglishShell>
	);
}
