import { useRef, useState } from "react";
import type { ProductClaim, ProductContent, ProductWorkbenchViewId } from "@/content/site/product";

type WorkbenchContent = ProductContent["workbench"];

function statusLabel(claim: ProductClaim, ui: WorkbenchContent["ui"]): string {
	switch (claim.status) {
		case "current-software":
			return ui.currentSoftwareLabel;
		case "managed-delivery":
			return ui.managedDeliveryLabel;
		case "illustrative":
			return ui.illustrativeLabel;
		case "verified-evidence":
			return ui.verifiedEvidenceLabel;
		case "direction":
			return ui.directionLabel;
	}
}

export function EvidenceWorkbench({ content }: { content: WorkbenchContent }): React.ReactNode {
	const [activeId, setActiveId] = useState<ProductWorkbenchViewId>(content.views[0].id);
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const activeIndex = content.views.findIndex((view) => view.id === activeId);

	function activate(index: number): void {
		const next = content.views[index];
		if (!next) return;
		setActiveId(next.id);
		tabRefs.current[index]?.focus();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
		let nextIndex: number | undefined;
		switch (event.key) {
			case "ArrowRight":
				nextIndex = (index + 1) % content.views.length;
				break;
			case "ArrowLeft":
				nextIndex = (index - 1 + content.views.length) % content.views.length;
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = content.views.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		activate(nextIndex);
	}

	return (
		<div className="product-workbench">
			<div className="product-workbench__heading">
				<div>
					<p className="product-workbench__eyebrow">{content.eyebrow}</p>
					<h2>{content.title}</h2>
				</div>
				<div className="product-workbench__intro">
					<span className="product-workbench__illustrative">{content.ui.illustrativeLabel}</span>
					<p>{content.description}</p>
				</div>
			</div>

			<div
				className="product-workbench__tabs"
				role="tablist"
				aria-label={content.ui.tabListLabel}
				aria-orientation="horizontal"
			>
				{content.views.map((view, index) => {
					const selected = index === activeIndex;
					const tabId = `product-workbench-tab-${view.id}`;
					const panelId = `product-workbench-panel-${view.id}`;
					return (
						<button
							key={view.id}
							ref={(node) => {
								tabRefs.current[index] = node;
							}}
							type="button"
							className="product-workbench__tab"
							id={tabId}
							role="tab"
							aria-controls={panelId}
							aria-selected={selected}
							tabIndex={selected ? 0 : -1}
							onClick={(event) => {
								setActiveId(view.id);
								event.currentTarget.focus();
							}}
							onKeyDown={(event) => handleKeyDown(event, index)}
						>
							<span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
							{view.tabLabel}
						</button>
					);
				})}
			</div>

			<div className="product-workbench__panels">
				{content.views.map((view, index) => {
					const selected = index === activeIndex;
					return (
						<div
							key={view.id}
							className="product-workbench__panel"
							id={`product-workbench-panel-${view.id}`}
							role="tabpanel"
							aria-labelledby={`product-workbench-tab-${view.id}`}
							hidden={!selected}
							tabIndex={selected ? 0 : -1}
						>
							<div className="product-workbench__record">
								<div className="product-workbench__record-heading">
									<p>
										{content.ui.illustrativeLabel} / {String(index + 1).padStart(2, "0")}
									</p>
									<h3>{view.title}</h3>
									<span>{view.description}</span>
								</div>
								<dl className="product-workbench__fields">
									{view.fields.map((field) => (
										<div key={field.label} className="product-workbench__field" data-state={field.state}>
											<dt>{field.label}</dt>
											<dd>
												<span className="product-workbench__field-state">
													{field.state === "known" ? content.ui.knownLabel : content.ui.unknownLabel}
												</span>
												<span>{field.state === "known" ? field.value : field.reason}</span>
											</dd>
										</div>
									))}
								</dl>
							</div>

							<aside
								className="product-workbench__claims"
								aria-label={`${view.tabLabel} ${content.ui.capabilityContextLabel}`}
							>
								{view.claims.map((claim) => (
									<div key={claim.id} className="product-workbench__claim" data-claim-status={claim.status}>
										<p className="product-workbench__claim-status">{statusLabel(claim, content.ui)}</p>
										<p className="product-workbench__claim-text">{claim.text}</p>
										<p className="product-workbench__claim-limit">{claim.limitation}</p>
									</div>
								))}
							</aside>
						</div>
					);
				})}
			</div>
		</div>
	);
}
