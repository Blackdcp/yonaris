import { useRef, useState } from "react";
import {
	GLOBAL_EVIDENCE_JOURNEY,
	type GlobalEvidenceStepId,
	getGlobalEvidenceStep,
} from "@/content/site/global-en/experience";
import { GraphicFrame } from "../graphic-frame";

function adjacentStep(current: GlobalEvidenceStepId, key: string): GlobalEvidenceStepId {
	const index = GLOBAL_EVIDENCE_JOURNEY.findIndex(({ id }) => id === current);
	if (key === "Home") return GLOBAL_EVIDENCE_JOURNEY[0]?.id ?? current;
	if (key === "End") return GLOBAL_EVIDENCE_JOURNEY.at(-1)?.id ?? current;
	const delta = ["ArrowRight", "ArrowDown"].includes(key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(key) ? -1 : 0;
	if (!delta) return current;
	return (
		GLOBAL_EVIDENCE_JOURNEY[(index + delta + GLOBAL_EVIDENCE_JOURNEY.length) % GLOBAL_EVIDENCE_JOURNEY.length]?.id ??
		current
	);
}

export function EvidenceJourney({ initialStep = "define" }: { initialStep?: GlobalEvidenceStepId }) {
	const [activeId, setActiveId] = useState<GlobalEvidenceStepId>(initialStep);
	const tabs = useRef(new Map<GlobalEvidenceStepId, HTMLButtonElement>());
	const active = getGlobalEvidenceStep(activeId);

	function select(id: GlobalEvidenceStepId, focus = false): void {
		setActiveId(id);
		if (focus) requestAnimationFrame(() => tabs.current.get(id)?.focus());
	}

	return (
		<GraphicFrame
			label="Interactive four-step evidence journey"
			type="evidence-journey"
			protagonist="evidence-path"
			progressive="non-hijacking"
		>
			<div className="global-en__journey">
				<div className="global-en__journey-tabs" role="tablist" aria-label="Choose an evidence journey step">
					{GLOBAL_EVIDENCE_JOURNEY.map((step, index) => (
						<button
							key={step.id}
							ref={(node) => {
								if (node) tabs.current.set(step.id, node);
								else tabs.current.delete(step.id);
							}}
							id={`evidence-step-${step.id}`}
							type="button"
							role="tab"
							aria-selected={step.id === activeId}
							aria-controls="evidence-journey-panel"
							tabIndex={step.id === activeId ? 0 : -1}
							onClick={() => select(step.id)}
							onKeyDown={(event) => {
								const next = adjacentStep(activeId, event.key);
								if (next === activeId && !["Home", "End"].includes(event.key)) return;
								event.preventDefault();
								select(next, true);
							}}
						>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<span>{step.label}</span>
						</button>
					))}
				</div>
				<article
					className="global-en__journey-panel"
					id="evidence-journey-panel"
					role="tabpanel"
					aria-labelledby={`evidence-step-${active.id}`}
					data-step={active.id}
				>
					<header>
						<small>{active.artifact}</small>
						<h3>{active.promise}</h3>
					</header>
					<section>
						<small>REVIEW QUESTION</small>
						<p>{active.reviewQuestion}</p>
					</section>
					<section>
						<small>BOUNDARY</small>
						<p>{active.boundary}</p>
					</section>
				</article>
			</div>
		</GraphicFrame>
	);
}
