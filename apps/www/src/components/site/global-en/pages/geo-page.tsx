import { GlobalEnglishShell } from "../global-english-shell";
import { EntryMap, EvidencePath } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function GeoPage() {
	return (
		<GlobalEnglishShell activeKey="geo">
			<PageHero
				id="entry-map-hero"
				eyebrow="GEO · APPLIED WORKFLOW"
				title="See where your brand enters an AI answer."
				lead="Generative engine optimization becomes useful when discovery, description, comparison, available sources, and repeat observation can each be inspected within a configured market scope."
				visual={<EntryMap />}
			/>
			<PageSection
				id="buyer-questions-and-artifacts"
				number="01"
				title="Every entry point answers a buyer question."
				body="The map pairs a question with an evidence artifact instead of presenting a decorative coverage map."
			>
				<EntryMap />
			</PageSection>
			<PageSection
				id="applied-workflow"
				number="02"
				title="Move from entry point to evidence path."
				body="A question-led workflow makes the next decision traceable without reducing Yonaris to a single acronym."
			>
				<EvidencePath />
			</PageSection>
			<PageSection
				id="scope-matrix"
				number="03"
				title="Global service capability is configured, not universal."
				body="Market and language can be configured alongside question set, supported surface, cohort, and observation period."
			>
				<div className="global-en__matrix" data-graphic="geo-scope-matrix">
					<span>Market</span>
					<span>Language</span>
					<span>Question set</span>
					<span>Supported surface</span>
					<span>Cohort</span>
					<span>Observation period</span>
				</div>
			</PageSection>
			<PageSection
				id="product-evidence-bridge"
				number="04"
				title="GEO is one workflow inside a wider evidence system."
				body="Use Product to inspect the workbench and Evidence to understand denominators, record states, and comparison limits."
			>
				<div className="global-en__bridge" data-graphic="product-evidence-bridge">
					<a href="/product">Product workbench →</a>
					<a href="/research">Evidence definitions →</a>
				</div>
			</PageSection>
			<CloseSection id="request-close" title="Define the market and language before asking what AI sees." />
		</GlobalEnglishShell>
	);
}
