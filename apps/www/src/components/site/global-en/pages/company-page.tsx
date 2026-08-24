import { GlobalEnglishShell } from "../global-english-shell";
import { OperatingModel, ResponsibilityLanes } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function CompanyPage() {
	return (
		<GlobalEnglishShell activeKey="company">
			<PageHero
				id="operating-model-hero"
				eyebrow="COMPANY"
				title="Evidence before conclusion."
				lead="Yonaris exists to make AI-mediated market representation reviewable—so teams can replace guesswork with a defined question, visible evidence, and one considered next test."
				visual={<OperatingModel />}
			/>
			<PageSection
				id="purpose-and-current-model"
				number="01"
				title="A software-and-service model built for the work as it exists today."
				body="Customers inspect records in the workspace. Yonaris operates configured collection and human review where the workflow is not yet self-service."
			>
				<ResponsibilityLanes />
			</PageSection>
			<PageSection
				id="verified-trust-slot"
				number="02"
				title="Trust facts appear only when verified."
				body="We do not invent a team roster, customer history, office footprint, response time, or coverage number. The diagnostic route is the verified commercial entry point."
			>
				<div className="global-en__trust-slot" data-graphic="verified-trust">
					<span>VERIFIED ROUTE</span>
					<b>/diagnostic</b>
					<i>Scope review before collection</i>
				</div>
			</PageSection>
			<PageSection
				id="principles"
				number="03"
				title="Four principles shape every evidence record."
				body="The product and delivery model share the same operating boundaries."
			>
				<ol className="global-en__principles" data-graphic="principles">
					<li>Evidence before conclusion</li>
					<li>Explicit scope</li>
					<li>Human review</li>
					<li>Durable product facts</li>
				</ol>
			</PageSection>
			<CloseSection id="diagnostic-close" title="Bring the decision. We will help define the evidence question." />
		</GlobalEnglishShell>
	);
}
