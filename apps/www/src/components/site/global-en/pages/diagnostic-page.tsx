import { GlobalEnglishShell } from "../global-english-shell";
import { DiagnosticPreview, PrivacyFlow } from "../visuals/visuals";
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
				id="two-stage-form"
				number="02"
				title="The request form is privacy-gated."
				body="The form remains disabled until the notice, operational handling, region gate, and analytics boundary have been verified."
			>
				<form
					className="global-en__disabled-form"
					data-submission-state="disabled"
					aria-label="Diagnostic request unavailable"
				>
					<fieldset disabled>
						<legend>Scope</legend>
						<label>
							Website
							<input name="website" />
						</label>
						<label>
							Brand
							<input name="brand" />
						</label>
						<label>
							Target market or region
							<input name="market" />
						</label>
						<label>
							Target language
							<input name="targetLanguage" />
						</label>
						<label>
							Decision question
							<textarea name="question" />
						</label>
						<button type="button">Submit diagnostic request</button>
					</fieldset>
				</form>
			</PageSection>
			<PageSection
				id="privacy-failure-and-alternate"
				number="03"
				title="Submission is unavailable until the privacy review is verified."
				body="No lead data is collected by this disabled surface. Return later when the verified privacy boundary is active."
			>
				<PrivacyFlow />
				<a className="global-en__text-link" href="/privacy">
					Read the privacy gate →
				</a>
			</PageSection>
		</GlobalEnglishShell>
	);
}
