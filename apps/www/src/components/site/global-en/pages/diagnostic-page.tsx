import { DiagnosticForm } from "../../pages/diagnostic-form";
import { GlobalEnglishShell } from "../global-english-shell";
import { DiagnosticPreview } from "../visuals/visuals";
import { PageHero, PageSection } from "./page-primitives";

export function DiagnosticPage() {
	return (
		<GlobalEnglishShell activeKey="diagnostic">
			<PageHero
				id="deliverable-hero"
				eyebrow="FOCUSED DIAGNOSTIC"
				title="Request a focused AI market diagnostic."
				lead="Begin with one brand, one market, and one decision question. Submission begins a scope review; it does not return an instant scan or score."
				visual={<DiagnosticPreview />}
			/>
			<PageSection
				id="request-timeline"
				number="01"
				title="Know what happens before evidence collection begins."
				body="A focused request moves from scope review to agreed observation conditions, selected evidence, and a reviewed next-test candidate."
			>
				<div className="global-en__timeline" data-graphic="request-timeline">
					<span>Request</span>
					<i>→</i>
					<span>Scope review</span>
					<i>→</i>
					<span>Defined observation</span>
					<i>→</i>
					<span>Review</span>
				</div>
			</PageSection>
			<PageSection
				id="lead-form"
				number="02"
				title="Three details are enough to start."
				body="Share your name, work email, and company. Submission sends the request to Yonaris for a human scope review."
			>
				<DiagnosticForm locale="en" />
			</PageSection>
			<PageSection
				id="delivery-privacy"
				number="03"
				title="A confirmed submission means the email provider accepted the request."
				body="The browser does not claim success until the server confirms delivery. Form values are not placed in analytics events, local storage, or cookies."
			>
				<div className="global-en__delivery-path" data-graphic="lead-delivery-path">
					<span>Three-field request</span>
					<i>→</i>
					<span>Server validation</span>
					<i>→</i>
					<span>Email accepted</span>
					<i>→</i>
					<strong>Human review</strong>
				</div>
				<a className="global-en__text-link" href="/privacy">
					Read the privacy note →
				</a>
			</PageSection>
		</GlobalEnglishShell>
	);
}
