"use client";

import { useState } from "react";
import { EN_READING_RECORDS, PAGE_FACTS } from "@/content/experience/canonical-public-facts";
import { GLOBAL_COPY } from "@/content/experience/global-copy";
import { ComparisonStage, type ComparisonStageRecord } from "../shared/comparison-stage";
import { DualReadingStage } from "../shared/dual-reading-stage";
import { EvidenceSheet } from "../shared/evidence-sheet";
import { OrbitField } from "../shared/orbit-field";
import { type ReviewRecord, ReviewSwitch } from "../shared/review-switch";
import { useRovingTabs } from "../shared/use-roving-tabs";

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
] as const;

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

const HOME_READING_MODES = ["human", "agent"] as const;

const HOME_DOSSIER_NOTES = [
	{
		id: "proof",
		label: "what the company can prove",
		heading: "Proof has to survive inspection.",
		note: "A claim earns weight when a buyer can reach the public source and see the condition it actually supports.",
	},
	{
		id: "language",
		label: "how the market describes the decision",
		heading: "The market supplies the comparison language.",
		note: "The relevant wording comes from the buyer’s question, market and alternatives—not from an internal feature list.",
	},
	{
		id: "review",
		label: "reviewed under the same conditions",
		heading: "A retest needs a stable baseline.",
		note: "Keep the question, market, language, time and AI surface comparable before treating an answer change as evidence.",
	},
] as const;

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
	const record = EN_READING_RECORDS[0];
	const [mode, setMode] = useState<(typeof HOME_READING_MODES)[number]>("human");
	const modeTabs = useRovingTabs({
		items: HOME_READING_MODES,
		active: mode,
		onChange: setMode,
		idPrefix: "site-06-home-claim",
	});

	if (!record) return null;

	return (
		<div className="site-06-home-orbit" data-scene-object="fixed-claim-reader">
			<OrbitField label="One market claim shown for human and agent reading" interactive>
				<strong>Fixed public claim</strong>
			</OrbitField>
			<article className="site-06-home-claim" id={record.stableId} data-stable-id={record.stableId} tabIndex={-1}>
				<div className="site-06-home-claim__modes" role="tablist" aria-label="Choose a reading">
					{HOME_READING_MODES.map((item, index) => (
						<button key={item} type="button" {...modeTabs.getTabProps(item, index)}>
							{item === "human" ? "Human reading" : "Agent reading"}
						</button>
					))}
				</div>
				<section className="site-06-home-claim__human" {...modeTabs.getPanelProps("human")}>
					<p>{record.human}</p>
					<p>{record.meaning}</p>
				</section>
				<section className="site-06-home-claim__agent" {...modeTabs.getPanelProps("agent")}>
					<dl>
						<div>
							<dt>Fact</dt>
							<dd>{record.fact}</dd>
						</div>
						<div>
							<dt>Evidence</dt>
							<dd>{record.evidence}</dd>
						</div>
						<div>
							<dt>Boundary</dt>
							<dd>{record.boundary}</dd>
						</div>
						<div>
							<dt>Stable ID</dt>
							<dd>
								<code>{record.stableId}</code>
							</dd>
						</div>
					</dl>
				</section>
			</article>
		</div>
	);
}

export function BuyingQuestionDossier() {
	const noteIds = HOME_DOSSIER_NOTES.map((note) => note.id);
	const [activeId, setActiveId] = useState<(typeof HOME_DOSSIER_NOTES)[number]["id"]>("proof");
	const noteTabs = useRovingTabs({
		items: noteIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "site-06-home-note",
	});

	return (
		<div data-scene-object="inline-evidence-note">
			<EvidenceSheet
				label="Illustrative buying question and answer evidence"
				className="site-06-buyer-dossier"
				annotation={
					<div className="site-06-buyer-dossier__note" aria-live="polite">
						<span>De-identified buying question · Illustrative structure</span>
						{HOME_DOSSIER_NOTES.map((note) => (
							<section key={note.id} {...noteTabs.getPanelProps(note.id)}>
								<strong>{note.heading}</strong>
								<p>{note.note}</p>
							</section>
						))}
					</div>
				}
			>
				<p className="site-06-buyer-dossier__question">
					Which partner can support a complex B2B decision across markets with evidence the buying team can review?
				</p>
				<div className="site-06-buyer-dossier__answer" role="tablist" aria-label="Inspect the answer evidence">
					A defensible recommendation depends on{" "}
					{HOME_DOSSIER_NOTES.map((note, index) => (
						<span key={note.id}>
							{index === 1 ? ", " : index === 2 ? ", and whether the result can be " : null}
							<button type="button" {...noteTabs.getTabProps(note.id, index)}>
								{note.label}
							</button>
						</span>
					))}
					.
				</div>
			</EvidenceSheet>
		</div>
	);
}

export function MarketAnswerCaseFile() {
	const record = EN_READING_RECORDS[1];
	if (!record) return null;

	return (
		<article
			className="site-06-answer-workbench"
			id={record.stableId}
			data-stable-id={record.stableId}
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
			<aside className="site-06-answer-workbench__public-record">
				<p>{record.fact}</p>
				<p>{record.evidence}</p>
				<p>{record.boundary}</p>
			</aside>
		</article>
	);
}

export function PlatformInspectorScene() {
	const recordIds = EN_PLATFORM_RECORDS.map((record) => record.id);
	const [activeId, setActiveId] = useState<(typeof EN_PLATFORM_RECORDS)[number]["id"]>("fit");
	const inspectorTabs = useRovingTabs({
		items: recordIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "site-06-product-trace",
	});
	const fact = PAGE_FACTS.en.product;

	return (
		<article className="site-06-trace-workbench site-06-inspector" data-scene-object="trace-workbench" id={fact.id} tabIndex={-1}>
			<aside className="site-06-trace-workbench__question">
				<p className="site-06-kicker">One de-identified answer</p>
				<div role="tablist" aria-label="Inspect an observed answer">
					<blockquote>
						The recommended partner demonstrates{" "}
						{EN_PLATFORM_RECORDS.map((record, index) => (
							<span key={record.id}>
								{index === 1 ? ", " : index === 2 ? " and " : null}
								<button type="button" {...inspectorTabs.getTabProps(record.id, index)}>
									{record.label}
								</button>
							</span>
						))}
						.
					</blockquote>
				</div>
			</aside>
			<div className="site-06-inspector__records" aria-live="polite">
				<header className="site-06-trace-workbench__record-intro">
					<p>{fact.value}</p>
					<p>
						<strong>Public basis:</strong> {fact.source}
					</p>
					<p>
						<strong>Review boundary:</strong> {fact.boundary}
					</p>
				</header>
				{EN_PLATFORM_RECORDS.map((record) => (
					<article key={record.id} className="site-06-evidence-document" {...inspectorTabs.getPanelProps(record.id)}>
						<div className="site-06-evidence-document__answer">{record.answer}</div>
						<dl>
							<div>
								<dt>Source</dt>
								<dd>{record.source}</dd>
							</div>
							<div>
								<dt>Boundary</dt>
								<dd>{record.boundary}</dd>
							</div>
							<div>
								<dt>Buying effect</dt>
								<dd>{record.effect}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</article>
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
				eyebrow={GLOBAL_COPY.company.eyebrow}
				headingLevel="h1"
				heading={GLOBAL_COPY.company.title}
				description={GLOBAL_COPY.company.lead}
				records={EN_READING_RECORDS}
				initialId="category"
			/>
		</section>
	);
}
