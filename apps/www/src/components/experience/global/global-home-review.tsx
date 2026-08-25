import { useState } from "react";
import { GLOBAL_COPY } from "@/content/experience/global-copy";
import { AnswerEvidenceRail, AnswerFieldScene, type AnswerQuestionId } from "./global-scenes";

export function GlobalHomeReview() {
	const copy = GLOBAL_COPY.home;
	const [active, setActive] = useState<AnswerQuestionId>("shortlist");

	return (
		<>
			<section className="sf-home-opening">
				<div className="sf-home-opening__copy">
					<p className="sf-kicker">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="sf-lead">{copy.lead}</p>
					<div className="sf-actions">
						<a className="sf-button" href={copy.primaryAction.href}>
							{copy.primaryAction.label} <span aria-hidden="true">↗</span>
						</a>
					</div>
					<div className="sf-home-opening__shift">
						<span>Start focused</span>
						<i />
						<strong>One decision-critical question</strong>
						<small>Expand by brand · market · language</small>
					</div>
				</div>
				<AnswerFieldScene active={active} onChange={setActive} />
			</section>
			<AnswerEvidenceRail active={active} />
		</>
	);
}
