import { EN_READING_RECORDS } from "@/content/experience/canonical-public-facts";
import { EvidenceInspector, type EvidenceRecord } from "../shared/evidence-inspector";
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
		source: "Company capability record · public company material · named market condition · reviewed 26 Aug 2026.",
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
		source: "Scoped public evidence · first-party owner · decision-specific proof · reviewed 26 Aug 2026.",
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
		source: "Public delivery method · stated operating conditions · reviewed 26 Aug 2026.",
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

export function HomeReadingScene() {
	return (
		<div className="site-06-reading-scene">
			<OrbitField label="One market claim shown for human and agent reading" interactive>
				<strong>One public claim, read in two ways</strong>
			</OrbitField>
			<ReadingLens locale="en" records={EN_READING_RECORDS} initialId="category" />
		</div>
	);
}

export function BuyingQuestionDossier() {
	return (
		<>
			<article className="site-06-evidence-document" aria-label="Illustrative buying question and answer evidence">
				<header>
					<span>De-identified buying question</span>
					<strong>Answer and evidence reading</strong>
				</header>
				<p className="site-06-evidence-document__answer">
					Which partner can support a complex B2B decision across markets without reducing it to a media metric?
				</p>
				<p>
					A defensible recommendation depends on what the company can prove, how the market describes the decision, and
					whether the result can be reviewed under the same conditions.
				</p>
			</article>
			<EvidenceInspector records={EN_PLATFORM_RECORDS} initialId="fit" />
		</>
	);
}

export function MarketAnswerCaseFile() {
	return (
		<article className="site-06-evidence-document" aria-label="Illustrative market answer case file">
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
	return <EvidenceInspector records={EN_PLATFORM_RECORDS} initialId="fit" />;
}

export function EvidenceReviewScene({ preview = false }: { preview?: boolean }) {
	return (
		<>
			{preview ? (
				<section className="site-06-review-preview" aria-label="Baseline and retest evidence preview">
					{EN_REVIEW_STATES.map((state) => (
						<p key={state.id} data-review-state={state.id}>
							<strong>{state.label}</strong> {state.answer}
						</p>
					))}
				</section>
			) : null}
			<ReviewSwitch locale="en" question={EN_REVIEW_QUESTION} states={EN_REVIEW_STATES} initialId="baseline" />
		</>
	);
}

export function CompanyReadingScene() {
	return <ReadingLens locale="en" records={EN_READING_RECORDS} initialId="category" />;
}
