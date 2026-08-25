import { useState } from "react";

const answerQuestions = [
	{
		id: "category",
		label: "Category",
		prompt: "Which platforms help manufacturers coordinate product quality across multiple sites?",
		answer: "The answer groups providers by workflow, integrations, and rollout scope.",
	},
	{
		id: "comparison",
		label: "Comparison",
		prompt: "How should I compare quality platforms for a multi-site manufacturing group?",
		answer: "The providers are compared on deployment, integrations, and operating fit.",
	},
	{
		id: "recommendation",
		label: "Recommendation",
		prompt: "Which quality platform fits a manufacturer expanding into new markets?",
		answer: "The recommendation names evaluation criteria and includes available citations.",
	},
] as const;

export function AnswerFieldScene() {
	const [active, setActive] = useState(0);
	const question = answerQuestions[active];

	return (
		<section
			className="sf-answer-field"
			aria-label="Explore an illustrative buyer question and AI answer"
			data-scene-output="answer-field"
		>
			<div className="sf-answer-field__topline">
				<span>Illustrative buyer question</span>
				<span>What AI says · 01</span>
			</div>
			<fieldset className="sf-answer-field__questions" aria-label="Choose a buying question">
				{answerQuestions.map((item, index) => (
					<button
						key={item.id}
						type="button"
						data-answer-question={item.id}
						aria-pressed={active === index}
						onClick={() => setActive(index)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.label}
					</button>
				))}
			</fieldset>

			<div className="sf-answer-field__canvas">
				<svg className="sf-answer-field__routes" viewBox="0 0 720 420" aria-hidden="true">
					<path d="M116 92 C210 92 188 208 310 208" />
					<path d="M604 92 C508 92 530 208 410 208" />
					<path d="M116 328 C210 328 188 224 310 224" />
					<path d="M604 328 C508 328 530 224 410 224" />
				</svg>
				<article className="sf-answer-signal sf-answer-signal--brand" data-answer-signal="brand">
					<span>Brand meaning</span>
					<strong>What you want to own</strong>
				</article>
				<article className="sf-answer-signal sf-answer-signal--category" data-answer-signal="category">
					<span>Category frame</span>
					<strong>What the market expects</strong>
				</article>
				<article className="sf-answer-signal sf-answer-signal--competition" data-answer-signal="competition">
					<span>Alternatives</span>
					<strong>Who enters the comparison</strong>
				</article>
				<article className="sf-answer-signal sf-answer-signal--sources" data-answer-signal="sources">
					<span>Visible citations</span>
					<strong>Which sources are included</strong>
				</article>
				<div className="sf-answer-field__answer" aria-live="polite">
					<span>Illustrative answer readout</span>
					<p>{question.prompt}</p>
					<strong>{question.answer}</strong>
				</div>
			</div>
		</section>
	);
}

const productSteps = [
	{
		id: "see",
		label: "Observe",
		title: "Read the complete answer",
		body: "Review the response for one selected buyer question.",
		metric: "Answer text",
		primary: "Full response in view",
		secondary: "Brand mention shown in context",
	},
	{
		id: "understand",
		label: "Compare",
		title: "Compare brands and alternatives",
		body: "See which names appear and how each is described in the same response.",
		metric: "Brand comparison",
		primary: "Named alternatives together",
		secondary: "Descriptions kept side by side",
	},
	{
		id: "improve",
		label: "Review",
		title: "Inspect citations and gaps",
		body: "Review visible citations and record omissions or inconsistencies for the team.",
		metric: "Review items",
		primary: "Visible citations listed",
		secondary: "Information gaps recorded",
	},
	{
		id: "compare",
		label: "Recheck",
		title: "Compare the same question again",
		body: "Repeat the same market, language, and buyer question to see what changed.",
		metric: "Repeat check",
		primary: "Earlier and later answers",
		secondary: "Differences visible together",
	},
] as const;

type ProductStepId = (typeof productSteps)[number]["id"];

export function ProductLensScene() {
	const [active, setActive] = useState<ProductStepId>("see");

	return (
		<section
			className="sf-product-lens"
			aria-label="Explore the Yonaris answer review"
			data-scene-output="product-lens"
		>
			<div className="sf-product-lens__rail" role="tablist" aria-label="Product journey">
				{productSteps.map((step, index) => (
					<button
						key={step.id}
						type="button"
						role="tab"
						data-product-step={step.id}
						aria-selected={active === step.id}
						aria-controls={`product-panel-${step.id}`}
						onClick={() => setActive(step.id)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{step.label}
					</button>
				))}
			</div>

			<div className="sf-product-lens__screen">
				<header>
					<span className="sf-product-lens__status">
						<i /> Market question
					</span>
					<span>Yonaris / Answer review</span>
				</header>
				{productSteps.map((step) => (
					<section
						key={step.id}
						id={`product-panel-${step.id}`}
						role="tabpanel"
						hidden={active !== step.id}
						className="sf-product-lens__panel"
					>
						<div className="sf-product-lens__narrative">
							<span>{step.label}</span>
							<h3>{step.title}</h3>
							<p>{step.body}</p>
						</div>
						<div className="sf-product-lens__signal-card">
							<span>{step.metric}</span>
							<strong>{step.primary}</strong>
							<div className="sf-product-lens__meter">
								<i />
							</div>
							<small>{step.secondary}</small>
						</div>
						<div className="sf-product-lens__answer-stack" aria-hidden="true">
							<i />
							<i />
							<i />
							<i />
						</div>
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
		detail: "Name the buying decision that matters before measuring anything around it.",
	},
	{
		id: "field",
		label: "Review what AI says",
		detail: "See the brand, alternatives, category language, and sources together.",
	},
	{
		id: "move",
		label: "Record what needs review",
		detail: "List observed omissions, inconsistencies, and visible citations for the team.",
	},
	{
		id: "return",
		label: "Return to the question",
		detail: "Repeat the same question and compare the new answer with the earlier result.",
	},
] as const;

export function ChangePathScene() {
	const [active, setActive] = useState(0);

	return (
		<section className="sf-change-path" aria-label="Explore the path from question to market progress">
			<div className="sf-change-path__orbit" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<ol className="sf-change-path__stages">
				{changeStages.map((stage, index) => (
					<li key={stage.id} data-change-stage={stage.id}>
						<button type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
							<span>{String(index + 1).padStart(2, "0")}</span>
							<strong>{stage.label}</strong>
						</button>
					</li>
				))}
			</ol>
			<div className="sf-change-path__detail" aria-live="polite">
				<span>Where you move next</span>
				<p>{changeStages[active].detail}</p>
			</div>
		</section>
	);
}

const marketLenses = [
	{
		id: "language",
		city: "Language",
		region: "Buyer wording",
		question: "How do customers in the selected language describe this need?",
		focus: "Local question phrasing",
	},
	{
		id: "category",
		city: "Category",
		region: "Local terms",
		question: "Which category terms appear in answers for this selected market?",
		focus: "Category description",
	},
	{
		id: "alternatives",
		city: "Alternatives",
		region: "Relevant competitors",
		question: "Which named alternatives appear beside the brand in this market?",
		focus: "Competitor comparison",
	},
] as const;

export function MarketAtlasScene() {
	const [active, setActive] = useState(0);
	const market = marketLenses[active];

	return (
		<section className="sf-market-atlas" aria-label="Compare buyer questions across market contexts">
			<div className="sf-market-atlas__map">
				<svg viewBox="0 0 820 430" aria-hidden="true">
					<path
						className="sf-market-atlas__land"
						d="M52 132c70-64 142-77 219-44 36 15 59 46 56 84-4 50-52 55-85 78-36 25-54 90-102 73-35-12-25-67-51-91-27-24-71-66-37-100Zm313-43c39-28 94-13 117 23 18 29-4 56 7 88 11 31 55 50 35 87-22 41-85 44-110 7-20-29 6-61-8-90-18-38-80-86-41-115Zm233 29c61-52 144-45 187 13 28 37-6 76-40 95-36 19-59 42-91 70-39 35-103 3-99-51 3-45-4-90 43-127Z"
					/>
					<path className="sf-market-atlas__arc" d="M169 224C295 62 505 68 660 196" />
					<path className="sf-market-atlas__arc" d="M169 224c170 79 319 79 491-28" />
				</svg>
				{marketLenses.map((item, index) => (
					<button
						key={item.id}
						type="button"
						className={`sf-market-atlas__node sf-market-atlas__node--${index + 1}`}
						data-market-node={item.id}
						aria-label={`Choose ${item.city} lens`}
						aria-pressed={active === index}
						onClick={() => setActive(index)}
					>
						<i />
						<span>{item.city}</span>
					</button>
				))}
			</div>
			<fieldset className="sf-market-atlas__choices" aria-label="Choose a market lens">
				{marketLenses.map((item, index) => (
					<button
						key={item.id}
						type="button"
						data-market-choice={item.id}
						aria-pressed={active === index}
						onClick={() => setActive(index)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.region}
					</button>
				))}
			</fieldset>
			<div className="sf-market-atlas__question" aria-live="polite">
				<span>{market.city} · Compare markets</span>
				<p>{market.question}</p>
				<strong>{market.focus}</strong>
			</div>
		</section>
	);
}

const companyNodes = [
	{ id: "brand", label: "Brand truth", body: "Keep the facts and distinction the market should understand." },
	{ id: "buyers", label: "Buyer reality", body: "Begin with the questions customers actually use to compare options." },
	{
		id: "markets",
		label: "Market context",
		body: "Work in the language, category, and competitive context of each market.",
	},
	{
		id: "decisions",
		label: "Clear decisions",
		body: "Show what deserves attention before a team decides what to change.",
	},
] as const;

export function CompanyConstellationScene() {
	const [active, setActive] = useState(0);

	return (
		<section className="sf-constellation" aria-label="Explore how Yonaris works across brands and markets">
			<svg viewBox="0 0 720 520" aria-hidden="true">
				<circle cx="360" cy="260" r="176" />
				<circle cx="360" cy="260" r="112" />
				<path d="M146 124 360 260 574 124M146 396 360 260 574 396" />
			</svg>
			<div className="sf-constellation__center">
				<span>Y</span>
				<strong>Yonaris</strong>
			</div>
			{companyNodes.map((node, index) => (
				<button
					key={node.id}
					type="button"
					className={`sf-constellation__node sf-constellation__node--${index + 1}`}
					data-constellation-node={node.id}
					aria-pressed={active === index}
					onClick={() => setActive(index)}
				>
					<i />
					{node.label}
				</button>
			))}
			<div className="sf-constellation__detail" aria-live="polite">
				<span>{companyNodes[active].label}</span>
				<p>{companyNodes[active].body}</p>
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
					<strong>We start with your question</strong>
					<small>Brand, market, buying decision</small>
				</li>
				<li data-contact-step="direction">
					<span>03</span>
					<strong>We frame the next step</strong>
					<small>A focused first conversation</small>
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
