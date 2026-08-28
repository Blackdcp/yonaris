"use client";

import { type MouseEvent, useState } from "react";
import type { AgentFact, AgentTopic, ExperienceLocale } from "@/content/experience/types";
import { useRovingTabs } from "../shared/use-roving-tabs";

const directoryCopy = {
	en: {
		questions: "Questions this record can answer",
		answer: "Direct answer",
		answerHint: "Select a fact to inspect its evidence and boundary.",
		inspector: "Selected fact",
		fact: "Fact",
		evidence: "Evidence",
		boundary: "Boundary",
		stableId: "Stable ID",
		facts: "Public fact directory",
		factDirectoryLabel: "Fact directory",
		humanAnchor: "Open the Human evidence",
		humanReading: "Human reading",
		agentReading: "Agent reading",
		readingMode: "Choose reading mode",
		humanContext: "Decision context",
		agentContext: "Explicit fact record",
	},
	zh: {
		questions: "这份记录可以回答的问题",
		answer: "直接回答",
		answerHint: "选择一条事实，查看它的证据与边界。",
		inspector: "当前事实",
		fact: "事实",
		evidence: "证据",
		boundary: "边界",
		stableId: "稳定 ID",
		facts: "公开事实目录",
		factDirectoryLabel: "事实目录",
		humanAnchor: "打开人类阅读依据",
		humanReading: "人类阅读",
		agentReading: "Agent 阅读",
		readingMode: "选择阅读方式",
		humanContext: "业务判断语境",
		agentContext: "显式事实记录",
	},
} as const;

function allFacts(topic: AgentTopic): readonly AgentFact[] {
	return topic.groups.flatMap((group) => group.facts);
}

function factById(topic: AgentTopic, id: string | undefined): AgentFact | undefined {
	return allFacts(topic).find((fact) => fact.id === id);
}

export function resolveAgentDirectorySelection(
	topic: AgentTopic,
	selection: { questionId?: string; factId?: string },
): { questionId: string; factId: string } {
	const question = topic.questions.find((candidate) => candidate.id === selection.questionId) ?? topic.questions[0];
	if (!question) throw new Error(`Agent topic ${topic.id} has no canonical question`);
	const selectedFact =
		question.factIds.includes(selection.factId ?? "") && factById(topic, selection.factId)
			? selection.factId
			: question.factIds.find((factId) => factById(topic, factId));
	if (!selectedFact) throw new Error(`Agent question ${question.id} has no canonical fact`);
	return { questionId: question.id, factId: selectedFact };
}

export function commitAgentFactNavigation(
	factId: string,
	runtime: { replaceHash: (hash: string) => void; focusInspector: () => void },
): void {
	runtime.replaceHash(`#${factId}`);
	runtime.focusInspector();
}

export function AgentReadingPreview({ topic, locale }: { topic: AgentTopic; locale: ExperienceLocale }) {
	const copy = directoryCopy[locale];
	const modes = ["human", "agent"] as const;
	const [mode, setMode] = useState<(typeof modes)[number]>("human");
	const tabs = useRovingTabs({ items: modes, active: mode, onChange: setMode, idPrefix: `agent-reading-${topic.id}` });
	const fact = allFacts(topic)[0];
	if (!fact) return null;

	return (
		<article className="agent-experience__dual-record">
			<div className="agent-experience__reading-modes" role="tablist" aria-label={copy.readingMode}>
				{modes.map((item, index) => (
					<button key={item} type="button" {...tabs.getTabProps(item, index)}>
						{item === "human" ? copy.humanReading : copy.agentReading}
					</button>
				))}
			</div>
			<section {...tabs.getPanelProps("human")}>
				<p className="agent-experience__dual-label">{copy.humanContext}</p>
				<p className="agent-experience__dual-statement">{fact.value}</p>
				<p className="agent-experience__dual-note">
					{topic.summary} {topic.scope}
				</p>
			</section>
			<section {...tabs.getPanelProps("agent")}>
				<p className="agent-experience__dual-label">{copy.agentContext}</p>
				<dl className="agent-experience__machine-fact">
					<div>
						<dt>{copy.fact}</dt>
						<dd>{fact.value}</dd>
					</div>
					<div>
						<dt>{copy.evidence}</dt>
						<dd>{fact.source}</dd>
					</div>
					<div>
						<dt>{copy.boundary}</dt>
						<dd>{fact.boundary}</dd>
					</div>
					<div>
						<dt>{copy.stableId}</dt>
						<dd>
							<code>{fact.id}</code>
						</dd>
					</div>
				</dl>
			</section>
		</article>
	);
}

export function AgentDirectory({ topic, locale }: { topic: AgentTopic; locale: ExperienceLocale }) {
	const copy = directoryCopy[locale];
	const questionIds = topic.questions.map((question) => question.id);
	const [selection, setSelection] = useState(() => resolveAgentDirectorySelection(topic, {}));
	const questionTabs = useRovingTabs({
		items: questionIds,
		active: selection.questionId,
		onChange: (questionId) => setSelection(resolveAgentDirectorySelection(topic, { questionId })),
		idPrefix: `agent-question-${topic.id}`,
	});
	const selectedFact = factById(topic, selection.factId);
	if (!selectedFact) throw new Error(`Agent topic ${topic.id} is missing selected fact ${selection.factId}`);

	function selectFact(event: MouseEvent<HTMLAnchorElement>, questionId: string, factId: string) {
		event.preventDefault();
		setSelection(resolveAgentDirectorySelection(topic, { questionId, factId }));
		commitAgentFactNavigation(factId, {
			replaceHash: (hash) => window.history.replaceState(window.history.state, "", hash),
			focusInspector: () => document.getElementById("agent-fact-inspector")?.focus(),
		});
	}

	return (
		<>
			<div className="agent-experience__directory-layout">
				<aside
					className="agent-experience__question-index agent-experience__fact-index"
					data-scene-object="question-index"
				>
					<h2>{copy.questions}</h2>
					<div role="tablist" aria-label={copy.questions}>
						{topic.questions.map((question, index) => (
							<button key={question.id} type="button" {...questionTabs.getTabProps(question.id, index)}>
								{question.title}
							</button>
						))}
					</div>
				</aside>

				<section className="agent-experience__answer-document" data-scene-object="answer-document">
					<p className="agent-experience__section-label">{copy.answer}</p>
					{topic.questions.map((question) => (
						<section key={question.id} {...questionTabs.getPanelProps(question.id)}>
							<h2>{question.title}</h2>
							<p className="agent-experience__answer-hint">{copy.answerHint}</p>
							<div className="agent-experience__answer-claims">
								{question.factIds.map((factId) => {
									const fact = factById(topic, factId);
									if (!fact) return null;
									return (
										<a
											key={fact.id}
											href={`#${fact.id}`}
											aria-current={selection.factId === fact.id ? "location" : undefined}
											onClick={(event) => selectFact(event, question.id, fact.id)}
										>
											{fact.value}
										</a>
									);
								})}
							</div>
						</section>
					))}
				</section>

				<aside
					className="agent-experience__fact-inspector"
					data-scene-object="fact-inspector"
					id="agent-fact-inspector"
					tabIndex={-1}
					aria-live="polite"
					aria-atomic="true"
				>
					<h2>{copy.inspector}</h2>
					<dl>
						<div>
							<dt>{copy.fact}</dt>
							<dd>{selectedFact.value}</dd>
						</div>
						<div>
							<dt>{copy.evidence}</dt>
							<dd>{selectedFact.source}</dd>
						</div>
						<div>
							<dt>{copy.boundary}</dt>
							<dd>{selectedFact.boundary}</dd>
						</div>
						<div>
							<dt>{copy.stableId}</dt>
							<dd>
								<code>{selectedFact.id}</code>
							</dd>
						</div>
					</dl>
					<a href={selectedFact.evidenceUrl}>{copy.humanAnchor}</a>
				</aside>
			</div>

			<section
				className="agent-experience__facts"
				id="agent-facts"
				tabIndex={-1}
				aria-label={copy.factDirectoryLabel}
				data-scene-object="fact-directory"
			>
				<header className="agent-experience__facts-heading">
					<h2>{copy.facts}</h2>
				</header>
				{topic.groups.map((group) => (
					<section key={group.id} data-fact-group={group.id}>
						<header>
							<p>{group.title}</p>
						</header>
						{group.facts.map((fact) => (
							<article key={fact.id} id={fact.id} data-claim-id={fact.id} tabIndex={-1}>
								<h3>{fact.value}</h3>
								<dl>
									<div>
										<dt>{copy.evidence}</dt>
										<dd>{fact.source}</dd>
									</div>
									<div>
										<dt>{copy.boundary}</dt>
										<dd>{fact.boundary}</dd>
									</div>
									<div>
										<dt>{copy.stableId}</dt>
										<dd>
											<code>{fact.id}</code>
										</dd>
									</div>
								</dl>
								<a href={fact.evidenceUrl}>{copy.humanAnchor}</a>
							</article>
						))}
					</section>
				))}
			</section>
		</>
	);
}
