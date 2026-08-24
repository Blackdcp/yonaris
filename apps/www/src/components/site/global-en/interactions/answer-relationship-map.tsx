import { useState } from "react";
import { GraphicFrame } from "../graphic-frame";

type NodeId = "discovery" | "description" | "comparison" | "sources" | "measurement";

const nodes = [
	{ id: "discovery" as const, label: "Discovery", question: "Where does the brand enter the answer?", artifact: "Presence record" },
	{ id: "description" as const, label: "Description", question: "How is the brand and category explained?", artifact: "Claim annotation" },
	{ id: "comparison" as const, label: "Comparison", question: "Which criteria frame the choice?", artifact: "Cohort comparison" },
	{ id: "sources" as const, label: "Sources", question: "Which available evidence accompanies the answer?", artifact: "Source state" },
	{ id: "measurement" as const, label: "Measure", question: "What changed under the same observation rules?", artifact: "Repeat record" },
] as const;

export function AnswerRelationshipMap({ initialNode = "discovery" }: { initialNode?: NodeId }) {
	const [activeId, setActiveId] = useState<NodeId>(initialNode);
	const active = nodes.find(({ id }) => id === activeId) ?? nodes[0];

	return (
		<GraphicFrame label="Interactive AI answer relationship map" type="answer-relationship-map">
			<div className="global-en__relationship-map" role="tablist" aria-label="Choose an answer relationship">
				{nodes.map((node, index) => (
					<button key={node.id} type="button" role="tab" aria-selected={node.id === activeId} onClick={() => setActiveId(node.id)}>
						<em>{String(index + 1).padStart(2, "0")}</em><span>{node.label}</span>
					</button>
				))}
			</div>
			<article className="global-en__relationship-panel" role="tabpanel" data-node={active.id}>
				<small>BUYER QUESTION</small><h3>{active.question}</h3><span>{active.artifact}</span>
			</article>
		</GraphicFrame>
	);
}
