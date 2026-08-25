import { useState } from "react";
import { useRovingTabs } from "../shared/use-roving-tabs";

const answerQuestions = [
	{
		id: "shortlist",
		label: "Shortlist",
		prompt: "Which platforms help manufacturers coordinate product quality across multiple sites?",
		answer:
			"Illustrative answer: for a distributed manufacturer, the example brand belongs in the shortlist when the team needs one quality workflow across sites, documented integration paths, and a staged rollout. The response keeps those criteria separate so each statement can be reviewed.",
		presence: "The example brand appears in the opening shortlist and is described in relation to multi-site coordination.",
		comparison:
			"Supplied Alternative A is framed around a single-site start, while supplied Alternative B is framed around configurable reporting; neither is presented as a real company.",
		citations:
			"Illustrative citation 01 — example product overview; illustrative citation 02 — example deployment guide.",
		nextAction: "Check whether the example brand’s multi-site distinction is stated precisely in the supplied public information.",
	},
	{
		id: "accuracy",
		label: "Accuracy",
		prompt: "What makes this quality platform different for a distributed manufacturing team?",
		answer:
			"Illustrative answer: the example brand is described as supporting phased deployment and shared quality practices for distributed teams. The response does not explain how local teams and a central team divide daily ownership, leaving one material operating detail unresolved.",
		presence: "The example brand is present in the direct answer, with phased deployment named as its visible distinction.",
		comparison:
			"Supplied Alternative A receives a clearer description of local-versus-central workflow ownership, while the example brand receives the clearer rollout description.",
		citations:
			"Illustrative citation 03 — example category guide; illustrative citation 04 — example operating-model page.",
		nextAction: "Review the missing ownership detail against the supplied public information before changing the recorded description.",
	},
	{
		id: "comparison",
		label: "Comparison",
		prompt: "How should I compare quality platforms for a multi-site manufacturing group?",
		answer:
			"Illustrative answer: compare the example brand and the supplied alternatives on rollout sequence, integration depth, local workflow control, and evidence available to a buyer. The response uses the same four criteria for every option and leaves unverified details visibly unresolved.",
		presence: "The example brand appears in both the side-by-side comparison and the closing decision summary.",
		comparison:
			"Supplied Alternative A leads on a narrower integration example, supplied Alternative B leads on local configuration detail, and the example brand leads on the described rollout sequence.",
		citations:
			"Illustrative citation 05 — example integration notes; illustrative citation 06 — example buyer guide.",
		nextAction: "Confirm that each comparison criterion can be inspected in the supplied public information and mark any unsupported cell.",
	},
	{
		id: "market",
		label: "Market",
		prompt: "Which quality platform fits a manufacturer entering a selected new market?",
		answer:
			"Illustrative answer: in the selected market, the buying question uses local category wording and gives priority to implementation support in the chosen language. The example brand remains in scope, but its local description contains less workflow detail than the main-language description.",
		presence: "The example brand appears in the selected-market answer, although its local description is visibly abbreviated.",
		comparison:
			"Supplied Alternative B has the fuller local-language workflow description, while supplied Alternative A is included only for its market-specific implementation wording.",
		citations:
			"Illustrative citation 07 — example local product page; illustrative citation 08 — example market guide.",
		nextAction: "Check the abbreviated local description against the intended category position and record only the specific wording gap.",
	},
	{
		id: "priority",
		label: "Priority",
		prompt: "What should the brand team review first in this selected AI answer?",
		answer:
			"Illustrative answer: begin with the missing description of local-versus-central workflow ownership because the example brand is already present and the buying criteria are otherwise visible. Keep the complete response, comparison, and citation labels beside that one priority.",
		presence: "The example brand is present in the answer, so the first review item concerns description accuracy rather than absence.",
		comparison:
			"Supplied Alternative A owns the clearest workflow-ownership statement, making that precise difference more useful than a broad attempt to rewrite every comparison.",
		citations:
			"Illustrative citation 09 — example answer source label; illustrative citation 10 — example workflow overview.",
		nextAction: "Assign the workflow-ownership description gap, then recheck the same brand, market, language, question, and supplied alternatives.",
	},
] as const;

type AnswerQuestionId = (typeof answerQuestions)[number]["id"];
const answerQuestionIds = answerQuestions.map((question) => question.id);

export function AnswerFieldScene() {
	const [active, setActive] = useState<AnswerQuestionId>("shortlist");
	const tabs = useRovingTabs({
		items: answerQuestionIds,
		active,
		onChange: setActive,
		idPrefix: "answer-question",
	});
	const activeIndex = answerQuestionIds.indexOf(active);
	const activeQuestion = answerQuestions[activeIndex] ?? answerQuestions[0];
	const evidenceItems = [
		{ id: "question", label: "Selected buyer question", detail: activeQuestion.prompt },
		{ id: "answer", label: "Complete illustrative answer", detail: activeQuestion.answer },
		{ id: "presence", label: "Brand presence", detail: activeQuestion.presence },
		{ id: "comparison", label: "Alternatives and comparison", detail: activeQuestion.comparison },
		{ id: "citations", label: "Visible illustrative citations", detail: activeQuestion.citations },
		{ id: "action", label: "Next review action", detail: activeQuestion.nextAction },
	] as const;

	return (
		<section
			className="sf-answer-field"
			aria-label="Explore an illustrative buyer question and AI answer"
			data-scene-output="answer-field"
		>
			<div className="sf-answer-field__topline">
				<span>Illustrative buyer question</span>
				<span>Focused answer review · 01</span>
			</div>
			<div className="sf-answer-field__questions" role="tablist" aria-label="Choose an illustrative buying question">
				{answerQuestions.map((item, index) => (
					<button key={item.id} type="button" data-answer-question={item.id} {...tabs.getTabProps(item.id, index)}>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.label}
					</button>
				))}
			</div>

			<div className="sf-answer-field__canvas" data-active-question={active}>
				<svg className="sf-answer-field__routes" viewBox="0 0 720 420" aria-hidden="true">
					<path d="M58 88 C190 88 218 208 334 208" />
					<path d="M58 332 C190 332 218 224 334 224" />
					<path
						className="sf-answer-field__active-route"
						d="M58 210 C188 210 222 216 334 216"
						pathLength={1}
						style={{ transform: `translateY(${(activeIndex - 2) * 7}px)` }}
					/>
				</svg>
				<div className="sf-answer-field__scope" aria-hidden="true">
					<span>Question scope</span>
					<strong>Brand · market · language</strong>
					<small>One controlled review record</small>
				</div>
				<div className="sf-answer-field__panels" aria-live="polite">
					{answerQuestions.map((question) => (
						<article key={question.id} className="sf-answer-field__answer" {...tabs.getPanelProps(question.id)}>
							<header>
								<span>Selected buyer question</span>
								<div data-answer-field="question">
									<p>{question.prompt}</p>
								</div>
							</header>
							<dl>
								<div data-answer-field="answer">
									<dt>Complete illustrative answer</dt>
									<dd>{question.answer}</dd>
								</div>
								<div data-answer-field="presence">
									<dt>Brand presence</dt>
									<dd>{question.presence}</dd>
								</div>
								<div data-answer-field="comparison">
									<dt>Alternatives and comparison</dt>
									<dd>{question.comparison}</dd>
								</div>
								<div data-answer-field="citations">
									<dt>Visible illustrative citations</dt>
									<dd>{question.citations}</dd>
								</div>
								<div data-answer-field="action">
									<dt>Next review action</dt>
									<dd>{question.nextAction}</dd>
								</div>
							</dl>
						</article>
					))}
				</div>
			</div>
			<section
				className="sf-answer-evidence"
				data-evidence-rail="selected-record"
				data-evidence-record={active}
				aria-labelledby="answer-evidence-title"
			>
				<header>
					<span>Illustrative selected record</span>
					<h2 id="answer-evidence-title">The active question, answer, comparison, sources, and action</h2>
				</header>
				<ol>
					{evidenceItems.map((item, index) => (
						<li key={item.id} data-evidence-item={item.id}>
							<span>{String(index + 1).padStart(2, "0")}</span>
							<strong>{item.label}</strong>
							<p>{item.detail}</p>
						</li>
					))}
				</ol>
			</section>
		</section>
	);
}

const productSteps = [
	{
		id: "see",
		label: "Observe",
		title: "Read the selected answer",
		body: "Keep the complete illustrative response and its scope together.",
		input: "One buyer question, brand, market, and language.",
		evidence: "The complete answer with the brand shown in context.",
		decision: "Confirm whether the brand appears and whether its description is accurate.",
		action: "Carry the exact answer into the comparison stage.",
	},
	{
		id: "understand",
		label: "Compare",
		title: "Compare brand and alternatives",
		body: "Use the same answer to inspect the selected comparison set.",
		input: "The observed answer and the supplied named alternatives.",
		evidence: "Brand and alternative excerpts placed side by side.",
		decision: "Identify the clearest material difference in framing.",
		action: "Take that difference into citation and information-gap review.",
	},
	{
		id: "improve",
		label: "Review",
		title: "Inspect citations and gaps",
		body: "Separate visible source evidence from details the answer leaves unclear.",
		input: "The compared answer, visible citations, and the selected brand distinction.",
		evidence: "Citation labels and specific information gaps recorded together.",
		decision: "Choose the gap most relevant to the buying decision.",
		action: "Assign one review item with its supporting public information.",
	},
	{
		id: "compare",
		label: "Recheck",
		title: "Repeat the same scope",
		body: "Return to the controlled question instead of comparing unrelated prompts.",
		input: "The same question, brand, market, language, alternatives, and earlier record.",
		evidence: "Earlier and later complete answers shown side by side.",
		decision: "Record what changed, what stayed stable, and what remains unclear.",
		action: "Keep the next recheck scoped to the same decision record.",
	},
] as const;

type ProductStepId = (typeof productSteps)[number]["id"];
const productStepIds = productSteps.map((step) => step.id);

export function ProductLensScene() {
	const [active, setActive] = useState<ProductStepId>("see");
	const tabs = useRovingTabs({ items: productStepIds, active, onChange: setActive, idPrefix: "product" });

	return (
		<section
			className="sf-product-lens"
			aria-label="Explore the Yonaris answer review"
			data-scene-output="product-lens"
		>
			<div className="sf-product-lens__rail" role="tablist" aria-label="Product journey">
				{productSteps.map((step, index) => (
					<button key={step.id} type="button" data-product-step={step.id} {...tabs.getTabProps(step.id, index)}>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{step.label}
					</button>
				))}
			</div>

			<div className="sf-product-lens__screen">
				<header>
					<span className="sf-product-lens__status">
						<i /> Illustrative buying question · decision record
					</span>
					<span>Observe → Compare → Review → Recheck</span>
				</header>
				{productSteps.map((step) => (
					<section key={step.id} className="sf-product-lens__panel" {...tabs.getPanelProps(step.id)}>
						<div className="sf-product-lens__narrative">
							<span>{step.label}</span>
							<h3>{step.title}</h3>
							<p>{step.body}</p>
						</div>
						<dl className="sf-product-lens__record">
							<div data-decision-field="input">
								<dt>Input</dt>
								<dd>{step.input}</dd>
							</div>
							<div data-decision-field="evidence">
								<dt>Evidence</dt>
								<dd>{step.evidence}</dd>
							</div>
							<div data-decision-field="decision">
								<dt>Decision</dt>
								<dd>{step.decision}</dd>
							</div>
							<div data-decision-field="action">
								<dt>Next action</dt>
								<dd>{step.action}</dd>
							</div>
						</dl>
					</section>
				))}
			</div>
		</section>
	);
}

const changeStages = [
	{
		id: "question",
		label: "Choose the question",
		detail: "Name the buying decision that matters before reviewing any answer.",
		input: "Brand, market, language, buyer question, and supplied alternatives.",
		output: "A written review scope that keeps later checks comparable.",
	},
	{
		id: "field",
		label: "Review what AI says",
		detail: "Read the selected answer as a whole before isolating individual mentions.",
		input: "The scoped question and its complete illustrative answer.",
		output: "A captured answer with brand, alternatives, and visible citations in context.",
	},
	{
		id: "move",
		label: "Record the decision",
		detail: "Choose the observed issue that matters most to this buying decision.",
		input: "The complete answer, comparison frame, and visible source evidence.",
		output: "One explicit review priority with the reason it was selected.",
	},
	{
		id: "return",
		label: "Return to the question",
		detail: "Repeat the controlled scope and compare it with the earlier record.",
		input: "The original scope, earlier answer, and completed review item.",
		output: "A side-by-side change record and the next scoped review action.",
	},
] as const;

type ChangeStageId = (typeof changeStages)[number]["id"];
const changeStageIds = changeStages.map((stage) => stage.id);

export function ChangePathScene() {
	const [active, setActive] = useState<ChangeStageId>("question");
	const tabs = useRovingTabs({ items: changeStageIds, active, onChange: setActive, idPrefix: "approach" });

	return (
		<section
			className="sf-change-path"
			aria-label="Explore the review path from question to recheck"
			data-active-stage={active}
		>
			<div className="sf-change-path__orbit" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<div className="sf-change-path__stages" role="tablist" aria-label="Review stages">
				{changeStages.map((stage, index) => (
					<div key={stage.id} className="sf-change-path__stage" data-change-stage={stage.id} role="presentation">
						<button type="button" {...tabs.getTabProps(stage.id, index)}>
							<span>{String(index + 1).padStart(2, "0")}</span>
							<strong>{stage.label}</strong>
						</button>
					</div>
				))}
			</div>
			<div className="sf-change-path__panels" aria-live="polite">
				{changeStages.map((stage) => (
					<article key={stage.id} className="sf-change-path__detail" {...tabs.getPanelProps(stage.id)}>
						<span>{stage.label}</span>
						<p>{stage.detail}</p>
						<dl>
							<div data-approach-field="input">
								<dt>Input</dt>
								<dd>{stage.input}</dd>
							</div>
							<div data-approach-field="output">
								<dt>Output</dt>
								<dd>{stage.output}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}

const marketLenses = [
	{
		id: "language",
		label: "Language",
		region: "Buyer wording",
		question: "How does a buyer phrase the selected need in this language?",
		categoryFrame: "Use the category wording buyers use in the selected language.",
		alternativeFrame: "Keep the supplied named alternatives aligned to that local wording.",
		focus: "Check whether the brand remains clear when the buying language changes.",
	},
	{
		id: "category",
		label: "Category",
		region: "Local terms",
		question: "Which category definition frames the selected buying decision?",
		categoryFrame: "Compare the broad category with the narrower local buying frame.",
		alternativeFrame: "Review supplied named alternatives that enter this category frame.",
		focus: "Check whether the brand is described inside the intended category boundary.",
	},
	{
		id: "alternatives",
		label: "Alternatives",
		region: "Comparison set",
		question: "Which supplied named alternatives belong in this market comparison?",
		categoryFrame: "Hold the selected category definition constant during comparison.",
		alternativeFrame: "Place the example brand beside each supplied named alternative in the answer.",
		focus: "Check which decision criterion separates the brand from the selected alternatives.",
	},
] as const;

type MarketLensId = (typeof marketLenses)[number]["id"];
const marketLensIds = marketLenses.map((lens) => lens.id);

export function MarketAtlasScene() {
	const [active, setActive] = useState<MarketLensId>("language");
	const tabs = useRovingTabs({ items: marketLensIds, active, onChange: setActive, idPrefix: "market" });

	return (
		<section className="sf-market-atlas" aria-label="Compare illustrative buyer questions across market contexts">
			<div className="sf-market-atlas__map" aria-hidden="true">
				<svg viewBox="0 0 820 430" aria-hidden="true">
					<path
						className="sf-market-atlas__land"
						d="M52 132c70-64 142-77 219-44 36 15 59 46 56 84-4 50-52 55-85 78-36 25-54 90-102 73-35-12-25-67-51-91-27-24-71-66-37-100Zm313-43c39-28 94-13 117 23 18 29-4 56 7 88 11 31 55 50 35 87-22 41-85 44-110 7-20-29 6-61-8-90-18-38-80-86-41-115Zm233 29c61-52 144-45 187 13 28 37-6 76-40 95-36 19-59 42-91 70-39 35-103 3-99-51 3-45-4-90 43-127Z"
					/>
					<path className="sf-market-atlas__arc" d="M169 224C295 62 505 68 660 196" />
					<path className="sf-market-atlas__arc" d="M169 224c170 79 319 79 491-28" />
				</svg>
				{marketLenses.map((item, index) => (
					<span
						key={item.id}
						className={`sf-market-atlas__node sf-market-atlas__node--${index + 1}`}
						data-market-node={item.id}
						data-active={active === item.id ? "true" : undefined}
					>
						<i />
						<span>{item.label}</span>
					</span>
				))}
			</div>
			<div className="sf-market-atlas__choices" role="tablist" aria-label="Choose an illustrative market lens">
				{marketLenses.map((item, index) => (
					<button key={item.id} type="button" data-market-choice={item.id} {...tabs.getTabProps(item.id, index)}>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.region}
					</button>
				))}
			</div>
			<div className="sf-market-atlas__panels" aria-live="polite">
				{marketLenses.map((market) => (
					<article key={market.id} className="sf-market-atlas__question" {...tabs.getPanelProps(market.id)}>
						<span>Illustrative {market.label.toLowerCase()} lens</span>
						<dl>
							<div data-market-field="question">
								<dt>Concrete question</dt>
								<dd>{market.question}</dd>
							</div>
							<div data-market-field="category">
								<dt>Category frame</dt>
								<dd>{market.categoryFrame}</dd>
							</div>
							<div data-market-field="alternatives">
								<dt>Named-alternative frame</dt>
								<dd>{market.alternativeFrame}</dd>
							</div>
							<div data-market-field="focus">
								<dt>Review focus</dt>
								<dd>{market.focus}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}

const companyNodes = [
	{
		id: "scope",
		label: "Scoped questions",
		body: "Every review starts with a written brand, market, language, buyer question, and alternative set.",
		limit: "The scope does not stand in for every AI surface or every possible buyer prompt.",
	},
	{
		id: "answer",
		label: "Full-answer review",
		body: "Teams inspect the complete selected answer with brand and alternative mentions kept in context.",
		limit: "Yonaris does not reduce a review to an unexplained score or isolated mention.",
	},
	{
		id: "context",
		label: "Explicit market context",
		body: "The record names the selected language, category frame, buyer question, and supplied alternatives.",
		limit: "A result from one market is not presented as evidence for a different market.",
	},
	{
		id: "repeat",
		label: "Repeatable checks",
		body: "A recheck returns to the same written scope and keeps earlier and later answers together.",
		limit: "The record shows observed change; it does not guarantee a third-party answer outcome.",
	},
] as const;

type CompanyNodeId = (typeof companyNodes)[number]["id"];
const companyNodeIds = companyNodes.map((node) => node.id);

export function CompanyConstellationScene() {
	const [active, setActive] = useState<CompanyNodeId>("scope");
	const tabs = useRovingTabs({ items: companyNodeIds, active, onChange: setActive, idPrefix: "company" });

	return (
		<section className="sf-constellation" aria-label="Inspect Yonaris review boundaries">
			<svg viewBox="0 0 720 520" aria-hidden="true">
				<circle cx="360" cy="260" r="176" />
				<circle cx="360" cy="260" r="112" />
				<path d="M146 124 360 260 574 124M146 396 360 260 574 396" />
			</svg>
			<div className="sf-constellation__center" aria-hidden="true">
				<span>Y</span>
				<strong>Review boundary</strong>
			</div>
			<div className="sf-constellation__nodes" role="tablist" aria-label="Choose a review boundary">
				{companyNodes.map((node, index) => (
					<button
						key={node.id}
						type="button"
						className={`sf-constellation__node sf-constellation__node--${index + 1}`}
						data-constellation-node={node.id}
						{...tabs.getTabProps(node.id, index)}
					>
						<i />
						{node.label}
					</button>
				))}
			</div>
			<div className="sf-constellation__panels" aria-live="polite">
				{companyNodes.map((node) => (
					<article
						key={node.id}
						className="sf-constellation__detail"
						data-procurement-boundary={node.id}
						{...tabs.getPanelProps(node.id)}
					>
						<span>{node.label}</span>
						<p>{node.body}</p>
						<small>{node.limit}</small>
					</article>
				))}
			</div>
		</section>
	);
}

export function ContactSignalScene() {
	return (
		<section className="sf-contact-signal" aria-label="What happens after you contact Yonaris">
			<div className="sf-contact-signal__line" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<ol>
				<li data-contact-step="details">
					<span>01</span>
					<strong>You share three details</strong>
					<small>Name, work email, company</small>
				</li>
				<li data-contact-step="conversation">
					<span>02</span>
					<strong>The first conversation determines the review scope</strong>
					<small>Brand, market, language, buyer question, and supplied alternatives</small>
				</li>
				<li data-contact-step="direction">
					<span>03</span>
					<strong>No prepared report is required</strong>
					<small>Bring the business decision; the useful question can be shaped together</small>
				</li>
			</ol>
		</section>
	);
}

export function DataRouteScene() {
	return (
		<section className="sf-data-route" aria-label="The route taken by contact request details">
			<ol>
				<li data-data-step="submit">
					<span>01</span>
					<strong>You submit</strong>
					<small>Name · Work email · Company</small>
				</li>
				<li data-data-step="deliver">
					<span>02</span>
					<strong>Yonaris receives</strong>
					<small>The request is delivered to our team</small>
				</li>
				<li data-data-step="respond">
					<span>03</span>
					<strong>We respond</strong>
					<small>Your details support this conversation</small>
				</li>
			</ol>
			<div className="sf-data-route__pulse" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
		</section>
	);
}
