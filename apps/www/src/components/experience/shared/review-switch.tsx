import { useState } from "react";
import { useRovingTabs } from "./use-roving-tabs";

export interface ReviewRecord {
	readonly id: string;
	readonly label: string;
	readonly answer: string;
	readonly evidence: string;
	readonly judgment: string;
	readonly action: string;
}

export function ReviewSwitch({
	locale,
	question,
	states,
	initialId,
}: {
	locale: "en" | "zh";
	question: string;
	states: readonly ReviewRecord[];
	initialId: string;
}) {
	const stateIds = states.map((state) => state.id);
	const fallbackId = states.some((state) => state.id === initialId) ? initialId : (stateIds[0] ?? initialId);
	const [activeId, setActiveId] = useState(fallbackId);
	const tabs = useRovingTabs({ items: stateIds, active: activeId, onChange: setActiveId, idPrefix: "review" });
	const labels =
		locale === "en"
			? {
					context: "Illustrative method record · not a customer result",
					question: "Fixed question",
					answer: "Answer",
					evidence: "Evidence",
					judgment: "Judgment",
					action: "Next action",
					choose: "Choose a review state",
				}
			: {
					context: "公开方法演示 · 示例场景，不代表客户结果",
					question: "同一道问题",
					answer: "答案",
					evidence: "证据",
					judgment: "判断",
					action: "下一步行动",
					choose: "选择复核状态",
				};

	if (states.length === 0) return null;

	return (
		<section className="site-06-review" aria-label={labels.context}>
			<header className="site-06-review__question">
				<span>{labels.context}</span>
				<strong>{labels.question}</strong>
				<p>{question}</p>
			</header>
			<div className="site-06-tabs" role="tablist" aria-label={labels.choose}>
				{states.map((state, index) => (
					<button key={state.id} type="button" {...tabs.getTabProps(state.id, index)}>
						{state.label}
					</button>
				))}
			</div>
			<div className="site-06-review__records" aria-live="polite">
				{states.map((state) => (
					<article key={state.id} className="site-06-evidence-document" {...tabs.getPanelProps(state.id)}>
						<dl>
							<div>
								<dt>{labels.answer}</dt>
								<dd>{state.answer}</dd>
							</div>
							<div>
								<dt>{labels.evidence}</dt>
								<dd>{state.evidence}</dd>
							</div>
							<div>
								<dt>{labels.judgment}</dt>
								<dd>{state.judgment}</dd>
							</div>
							<div>
								<dt>{labels.action}</dt>
								<dd>{state.action}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}
