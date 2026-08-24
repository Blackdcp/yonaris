import { useRef, useState } from "react";
import {
	GLOBAL_ANSWER_QUESTIONS,
	getGlobalAnswerQuestion,
	type GlobalAnswerQuestionId,
} from "@/content/site/global-en/experience";
import { GraphicFrame } from "../graphic-frame";

const disclosure = "Interface demonstration — no customer or live observation data.";

function adjacentQuestion(current: GlobalAnswerQuestionId, key: string): GlobalAnswerQuestionId {
	const index = GLOBAL_ANSWER_QUESTIONS.findIndex(({ id }) => id === current);
	if (key === "Home") return GLOBAL_ANSWER_QUESTIONS[0]?.id ?? current;
	if (key === "End") return GLOBAL_ANSWER_QUESTIONS.at(-1)?.id ?? current;
	const delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
	if (!delta) return current;
	return GLOBAL_ANSWER_QUESTIONS[(index + delta + GLOBAL_ANSWER_QUESTIONS.length) % GLOBAL_ANSWER_QUESTIONS.length]?.id ?? current;
}

export function AnswerStudio({ initialQuestion = "recommended" }: { initialQuestion?: GlobalAnswerQuestionId }) {
	const [activeId, setActiveId] = useState<GlobalAnswerQuestionId>(initialQuestion);
	const tabs = useRef(new Map<GlobalAnswerQuestionId, HTMLButtonElement>());
	const active = getGlobalAnswerQuestion(activeId);

	function select(id: GlobalAnswerQuestionId, focus = false): void {
		setActiveId(id);
		if (focus) requestAnimationFrame(() => tabs.current.get(id)?.focus());
	}

	return (
		<GraphicFrame label="Interactive AI answer evidence demonstration" type="answer-studio">
			<div className="global-en__studio-bar">
				<span>Yonaris Answer Studio</span>
				<span>Defined buying question</span>
			</div>
			<div className="global-en__studio-layout">
				<div className="global-en__studio-questions" role="tablist" aria-label="Choose a market question">
					{GLOBAL_ANSWER_QUESTIONS.map((question, index) => (
						<button
							key={question.id}
							ref={(node) => {
								if (node) tabs.current.set(question.id, node);
								else tabs.current.delete(question.id);
							}}
							id={`answer-studio-tab-${question.id}`}
							type="button"
							role="tab"
							aria-selected={activeId === question.id}
							aria-controls="answer-studio-panel"
							tabIndex={activeId === question.id ? 0 : -1}
							onClick={() => select(question.id)}
							onKeyDown={(event) => {
								const next = adjacentQuestion(activeId, event.key);
								if (next === activeId && !["Home", "End"].includes(event.key)) return;
								event.preventDefault();
								select(next, true);
							}}
						>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<span>{question.label}</span>
						</button>
					))}
				</div>
				<article
					className="global-en__studio-panel"
					id="answer-studio-panel"
					role="tabpanel"
					aria-labelledby={`answer-studio-tab-${active.id}`}
					data-question={active.id}
				>
					<header>
						<small>BUYING QUESTION</small>
						<h3>{active.prompt}</h3>
					</header>
					<div className="global-en__studio-answer">
						<small>ANSWER</small>
						<p>{active.answer}</p>
					</div>
					<div className="global-en__studio-fields">
						<section>
							<small>EVIDENCE</small>
							<p>{active.evidence}</p>
						</section>
						<section>
							<small>FINDING</small>
							<p>{active.finding}</p>
						</section>
						<section>
							<small>NEXT TEST</small>
							<p>{active.nextTest}</p>
						</section>
					</div>
				</article>
			</div>
			<figcaption>{disclosure}</figcaption>
		</GraphicFrame>
	);
}
