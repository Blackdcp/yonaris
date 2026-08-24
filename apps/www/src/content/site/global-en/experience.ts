export type GlobalAnswerQuestionId = "recommended" | "accurate" | "competitor" | "sources" | "next-test";

export interface GlobalAnswerQuestion {
	id: GlobalAnswerQuestionId;
	label: string;
	prompt: string;
	answer: string;
	evidence: string;
	finding: string;
	nextTest: string;
}

export const GLOBAL_ANSWER_QUESTIONS: readonly GlobalAnswerQuestion[] = [
	{
		id: "recommended",
		label: "Are we being recommended?",
		prompt: "Which brands would you recommend for this defined buying question?",
		answer: "Review whether the target brand appears, where it appears, and which alternatives frame the answer.",
		evidence: "Keep the configured market, language, surface, question, and observed answer together.",
		finding: "Presence is meaningful only inside the declared comparison scope.",
		nextTest: "Repeat the same question after one approved information change.",
	},
	{
		id: "accurate",
		label: "Are we described accurately?",
		prompt: "How does the answer explain the target brand and its product category?",
		answer: "Compare the observed description with approved product facts and the intended market narrative.",
		evidence: "Annotate supported statements, missing facts, category drift, and unresolved ambiguity.",
		finding: "The gap is the difference between the observed answer and a verifiable product fact.",
		nextTest: "Clarify one durable public fact and observe the same defined question again.",
	},
	{
		id: "competitor",
		label: "Why is a competitor being preferred?",
		prompt: "What comparison criteria make one configured alternative more suitable?",
		answer: "Inspect which criteria, descriptions, and evidence states frame the configured competitor comparison.",
		evidence: "Keep competitor cohort and question intent visible beside the answer excerpt.",
		finding: "A preference claim is bounded by the configured cohort and cannot stand as a universal ranking.",
		nextTest: "Test one missing comparison fact under the same cohort and observation conditions.",
	},
	{
		id: "sources",
		label: "Which sources shape the answer?",
		prompt: "Which available citations or exposed source signals accompany the answer?",
		answer: "Record the sources the surface exposes and preserve unknown states when no source is available.",
		evidence: "Separate visible citations, exposed queries, and unavailable evidence instead of inferring them.",
		finding: "Available evidence can explain part of an answer; absence of evidence is not evidence of absence.",
		nextTest: "Review whether one authoritative fact is clear and accessible on an approved public surface.",
	},
	{
		id: "next-test",
		label: "What should we change next?",
		prompt: "Which bounded information change deserves the next observation?",
		answer: "Connect one observed gap to one reviewable change instead of generating a generic optimization list.",
		evidence: "The answer, finding, owner, change, and repeat-observation conditions remain linked.",
		finding: "A useful recommendation identifies both the evidence boundary and the decision owner.",
		nextTest: "Approve one change, keep the scope stable, and compare the next observation without claiming causality.",
	},
];

export function getGlobalAnswerQuestion(id: GlobalAnswerQuestionId): GlobalAnswerQuestion {
	const question = GLOBAL_ANSWER_QUESTIONS.find((candidate) => candidate.id === id);
	if (!question) throw new Error(`Unknown global answer question: ${id}`);
	return question;
}

export type GlobalProductModuleId = "scope" | "answers" | "evidence" | "experiments";

export interface GlobalProductModule {
	id: GlobalProductModuleId;
	label: string;
	question: string;
	output: string;
	owner: string;
	boundary: string;
}

export const GLOBAL_PRODUCT_MODULES: readonly GlobalProductModule[] = [
	{
		id: "scope",
		label: "Scope",
		question: "What must stay fixed for an observation to be comparable?",
		output: "A versioned brief for market, language, surface, question set, cohort, and observation period.",
		owner: "Customer and Yonaris approve the observation rules together.",
		boundary: "A configured scope is not universal market coverage.",
	},
	{
		id: "answers",
		label: "Answers",
		question: "What did the configured AI system return in this buying context?",
		output: "A reviewable answer record with prompt, response, comparison context, and observation time.",
		owner: "The system preserves the record; Yonaris reviews collection quality.",
		boundary: "One captured answer does not represent every user or future answer.",
	},
	{
		id: "evidence",
		label: "Evidence",
		question: "Which available sources and product facts can explain the answer?",
		output: "An annotated evidence note separating support, gaps, ambiguity, and unknown states.",
		owner: "Yonaris reviews the evidence; the customer verifies approved brand facts.",
		boundary: "Unavailable evidence remains unknown and is never inferred.",
	},
	{
		id: "experiments",
		label: "Experiments",
		question: "Which single information change deserves the next observation?",
		output: "A bounded test brief linking owner, change, baseline, and repeat-observation conditions.",
		owner: "The customer approves the change and decision; Yonaris preserves the measurement frame.",
		boundary: "Repeat observation supports comparison, not automatic causal proof.",
	},
];

export function getGlobalProductModule(id: GlobalProductModuleId): GlobalProductModule {
	const module = GLOBAL_PRODUCT_MODULES.find((candidate) => candidate.id === id);
	if (!module) throw new Error(`Unknown global product module: ${id}`);
	return module;
}
