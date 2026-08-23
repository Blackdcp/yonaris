import { useRef, useState } from "react";
import type { ApproachClaim, ApproachContent, EvidenceLoopStepId } from "@/content/site/approach";

function statusLabel(claim: ApproachClaim, content: ApproachContent["loop"]): string {
	return claim.status === "current-software" ? content.ui.currentSoftwareLabel : content.ui.managedDeliveryLabel;
}

export function EvidenceLoop({ content }: { content: ApproachContent["loop"] }): React.ReactNode {
	const [activeId, setActiveId] = useState<EvidenceLoopStepId>(content.steps[0].id);
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const activeIndex = content.steps.findIndex(({ id }) => id === activeId);
	const activeStep = content.steps[activeIndex] ?? content.steps[0];
	const activeClaim = content.claims.find(({ id }) => activeStep.claimIds.includes(id));
	const recordId = "approach-evidence-record";

	function activate(index: number): void {
		const next = content.steps[index];
		if (!next) return;
		setActiveId(next.id);
		buttonRefs.current[index]?.focus();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
		let nextIndex: number | undefined;
		switch (event.key) {
			case "ArrowLeft":
			case "ArrowUp":
				nextIndex = Math.max(0, index - 1);
				break;
			case "ArrowRight":
			case "ArrowDown":
				nextIndex = Math.min(content.steps.length - 1, index + 1);
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = content.steps.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		activate(nextIndex);
	}

	return (
		<div className="approach-loop__body">
			<ol className="evidence-loop__steps" aria-label={content.ui.processLabel}>
				{content.steps.map((step, index) => {
					const selected = step.id === activeStep.id;
					const buttonId = `approach-step-${step.id}`;
					return (
						<li key={step.id} className="evidence-loop__step" data-active={selected ? "true" : "false"}>
							<button
								ref={(node) => {
									buttonRefs.current[index] = node;
								}}
								type="button"
								id={buttonId}
								className="evidence-loop__step-button marketing-paper-focus"
								aria-controls={recordId}
								aria-current={selected ? "step" : undefined}
								tabIndex={selected ? 0 : -1}
								onClick={(event) => {
									setActiveId(step.id);
									event.currentTarget.focus();
								}}
								onKeyDown={(event) => handleKeyDown(event, index)}
							>
								<span className="evidence-loop__step-number" aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span className="evidence-loop__step-title">{step.title}</span>
								<span className="evidence-loop__step-state" aria-hidden="true" />
							</button>
							<p className="evidence-loop__summary">{step.summary}</p>
						</li>
					);
				})}
			</ol>

			<section className="evidence-loop__record" id={recordId} aria-labelledby={`approach-step-${activeStep.id}`}>
				<div className="evidence-loop__record-meta">
					<p>{content.ui.evidenceRecordLabel}</p>
					<span>
						{content.ui.activeStepLabel} {String(activeIndex + 1).padStart(2, "0")} / 06
					</span>
				</div>
				<div className="evidence-loop__record-heading">
					<p>{activeStep.evidenceLabel}</p>
					<h3>{activeStep.title}</h3>
				</div>
				<div className="evidence-loop__artifact">
					<p>{content.ui.evidenceArtifactLabel}</p>
					<strong>{activeStep.evidenceValue}</strong>
				</div>
				{activeClaim ? (
					<div className="evidence-loop__claim" data-claim-status={activeClaim.status}>
						<div className="evidence-loop__claim-heading">
							<p>{content.ui.capabilityContextLabel}</p>
							<span>{statusLabel(activeClaim, content)}</span>
						</div>
						<p className="evidence-loop__claim-text">{activeClaim.text}</p>
						<p className="evidence-loop__claim-limit">
							<span>{content.ui.limitationLabel}</span>
							{activeClaim.limitation}
						</p>
					</div>
				) : null}
			</section>
		</div>
	);
}
