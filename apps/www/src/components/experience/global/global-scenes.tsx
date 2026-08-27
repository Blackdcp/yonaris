import { EN_READING_RECORDS } from "@/content/experience/canonical-public-facts";
import { ComparisonStage, type ComparisonStageRecord } from "../shared/comparison-stage";
import { DualReadingStage } from "../shared/dual-reading-stage";
import { EvidenceInspector, type EvidenceRecord } from "../shared/evidence-inspector";
import { EvidenceSheet } from "../shared/evidence-sheet";
import { OrbitField } from "../shared/orbit-field";
import { ReadingLens } from "../shared/reading-lens";
import { type ReviewRecord, ReviewSwitch } from "../shared/review-switch";

export { EN_READING_RECORDS } from "@/content/experience/canonical-public-facts";

export const EN_PLATFORM_RECORDS = [
	{
		id: "fit",
		label: "market fit",
		answer: (
			<span data-evidence-state="fit">
				The answer uses fit with the buyer’s operating conditions as an entry requirement, not a popularity signal.
			</span>
		),
		source: "Company capability record · public company material · named market condition · reviewed 27 Aug 2026.",
		boundary: "The source supports this market and scope; it does not support a universal claim.",
		effect: "Without this connection, the company may not enter the comparison at all.",
	},
	{
		id: "authority",
		label: "credible authority",
		answer: (
			<span data-evidence-state="authority">
				The recommendation relies on a source that states who owns the claim, when it was reviewed and what it can
				prove.
			</span>
		),
		source: "Scoped public evidence · first-party owner · decision-specific proof · reviewed 27 Aug 2026.",
		boundary: "A first-party source supports the published fact; it is not independent validation.",
		effect:
			"A visible source gives the buying team something concrete to review instead of inheriting an unsupported claim.",
	},
	{
		id: "risk",
		label: "reviewable delivery risk",
		answer: (
			<span data-evidence-state="risk">
				The delivery model remains useful only when its operating boundary stays visible beside the recommendation.
			</span>
		),
		source: "Public delivery method · stated operating conditions · reviewed 27 Aug 2026.",
		boundary: "The record describes a review method and does not promise a customer outcome.",
		effect: "An explicit boundary lets the buyer compare delivery risk without treating suitability as certainty.",
	},
] as const satisfies readonly EvidenceRecord[];

export const EN_REVIEW_STATES = [
	{
		id: "baseline",
		label: "Baseline",
		answer: "The answer describes the company, but does not connect its strongest capability to the buying condition.",
		evidence: "Public product language is broad and no source states the operating boundary.",
		judgment: "The company is relevant, but not yet defensible as a preferred comparison.",
		action: "Publish the scoped proof required by the buying condition, then repeat the same question.",
	},
	{
		id: "retest",
		label: "Retest",
		answer: "The answer can connect the capability to the buyer’s condition with a visible, scoped source.",
		evidence: "The new source states the condition, scope and review date beside the capability.",
		judgment: "Record the changed answer only if the question and review conditions remain comparable.",
		action: "Preserve the retest with its model, market, language, sources and any limits on attribution.",
	},
] as const satisfies readonly ReviewRecord[];

export const EN_REVIEW_QUESTION = "Which company can support this decision without adding risk for the buying team?";

const EN_COMPARISON_RECORDS = [
	{
		id: "baseline",
		label: "Baseline",
		answer: "The answer describes the company, but does not connect its strongest capability to the buying condition.",
		evidence: "Public product language is broad and no source states the operating boundary.",
		judgment: "The company is relevant, but not yet defensible as a preferred comparison.",
		nextAction: "Publish the scoped proof required by the buying condition, then repeat the same question.",
	},
	{
		id: "retest",
		label: "Retest",
		answer: "The answer can connect the capability to the buyer’s condition with a visible, scoped source.",
		evidence: "The new source states the condition, scope and review date beside the capability.",
		judgment: "Record the changed answer only if the question and review conditions remain comparable.",
		nextAction: "Preserve the retest with its model, market, language, sources and any limits on attribution.",
	},
] as const satisfies readonly ComparisonStageRecord[];

export function HomeReadingScene() {
	return (
		<div className="site-06-home-orbit" data-scene-object="semantic-orbit-reader">
			<OrbitField label="One market claim shown for human and agent reading" interactive>
				<strong>One public claim, read in two ways</strong>
			</OrbitField>
			<div className="site-06-home-orbit__reader">
				<ReadingLens locale="en" records={EN_READING_RECORDS} initialId="category" />
			</div>
		</div>
	);
}

export function BuyingQuestionDossier() {
	return (
		<EvidenceSheet
			label="Illustrative buying question and answer evidence"
			className="site-06-buyer-dossier"
			annotation={<span>De-identified buying question · Illustrative structure</span>}
		>
			<p className="site-06-buyer-dossier__question">
				Which partner can support a complex B2B decision across markets with evidence the buying team can review?
			</p>
			<p className="site-06-buyer-dossier__answer">
				A defensible recommendation depends on what the company can prove, how the market describes the decision, and
				whether the result can be reviewed under the same conditions.
			</p>
			<EvidenceInspector records={EN_PLATFORM_RECORDS} initialId="fit" />
		</EvidenceSheet>
	);
}

export function MarketAnswerCaseFile() {
	return (
		<article
			className="site-06-answer-workbench"
			data-scene-object="answer-workbench"
			aria-label="Illustrative market answer case file"
		>
			<header>
				<span>Illustrative method structure</span>
				<h2>Trace a market answer back to the decision.</h2>
			</header>
			<p className="site-06-evidence-document__answer">
				The company is described accurately, but the evidence needed to enter the comparison is missing. Suitability
				alone does not create a place on the shortlist.
			</p>
			<dl>
				<div>
					<dt>Buying condition</dt>
					<dd>Can the team prove delivery confidence under the buyer’s operating conditions?</dd>
				</div>
				<div>
					<dt>Public company fact</dt>
					<dd>A scoped capability statement with a visible source.</dd>
				</div>
				<div>
					<dt>What changes first</dt>
					<dd>Prove the condition that controls entry into the comparison, then repeat the same question.</dd>
				</div>
			</dl>
		</article>
	);
}

export function PlatformInspectorScene() {
	return (
		<div className="site-06-trace-workbench" data-scene-object="trace-workbench">
			<aside className="site-06-trace-workbench__question">
				<p className="site-06-kicker">One de-identified answer</p>
				<blockquote>
					The recommended partner demonstrates market fit, credible authority and a delivery model whose risk can be
					reviewed.
				</blockquote>
			</aside>
			<EvidenceInspector records={EN_PLATFORM_RECORDS} initialId="fit" />
		</div>
	);
}

export function EvidenceReviewScene({ preview = false }: { preview?: boolean }) {
	if (preview) {
		return (
			<section aria-label="Illustrative method record · not a customer result">
				<ComparisonStage
					heading="Keep the question fixed. Let the evidence change."
					description="This illustrative record shows the method, not a customer result. The buyer question and review conditions stay comparable across both readings."
					question={EN_REVIEW_QUESTION}
					records={EN_COMPARISON_RECORDS}
					initialId="baseline"
				/>
			</section>
		);
	}

	return <ReviewSwitch locale="en" question={EN_REVIEW_QUESTION} states={EN_REVIEW_STATES} initialId="baseline" />;
}

export function CompanyReadingScene() {
	return (
		<section aria-label="Read public facts">
			<DualReadingStage
				locale="en"
				heading="One public record. Two legitimate readers."
				description="Category, purpose and scope stay canonical while the reading hierarchy changes."
				records={EN_READING_RECORDS}
				initialId="category"
			/>
		</section>
	);
}
