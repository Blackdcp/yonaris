import { GlobalEnglishShell } from "../global-english-shell";
import { EvidenceLedger, ResponsibilityLanes, ScopeRings } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function ProductPage() {
	return (
		<GlobalEnglishShell activeKey="product">
			<PageHero
				id="scope-rings-hero"
				eyebrow="PRODUCT · EVIDENCE WORKBENCH"
				title="Make AI market answers observable."
				lead="Define the market question, inspect configured answer evidence, and choose the next reviewed test without treating AI discovery as a black box."
				visual={<ScopeRings />}
				dark
			/>
			<PageSection
				id="evidence-workbench"
				number="01"
				title="A workbench built around evidence states, not dashboard theatre."
				body="Observation-dependent fields stay visibly unpopulated until an approved record is loaded."
				dark
			>
				<EvidenceLedger />
			</PageSection>
			<PageSection
				id="responsibility-lanes"
				number="02"
				title="Every handoff has an owner."
				body="System output, Yonaris review, and customer decision remain separate so recommendations never masquerade as autonomous action."
			>
				<ResponsibilityLanes />
			</PageSection>
			<PageSection
				id="scope-matrix"
				number="03"
				title="Coverage starts with a configured scope."
				body="The product records the exact dimensions that make an answer comparable."
			>
				<div className="global-en__matrix" data-graphic="scope-matrix">
					<span>Market</span>
					<span>Language</span>
					<span>Question set</span>
					<span>Supported surface</span>
					<span>Cohort</span>
					<span>Observation period</span>
				</div>
			</PageSection>
			<CloseSection id="request-close" title="Define the question before you collect the answer." />
		</GlobalEnglishShell>
	);
}
