import { useRef, useState } from "react";
import {
	GLOBAL_PRODUCT_MODULES,
	getGlobalProductModule,
	type GlobalProductModuleId,
} from "@/content/site/global-en/experience";
import { GraphicFrame } from "../graphic-frame";

const disclosure = "Interface demonstration — no customer or live observation data.";

function adjacentModule(current: GlobalProductModuleId, key: string): GlobalProductModuleId {
	const index = GLOBAL_PRODUCT_MODULES.findIndex(({ id }) => id === current);
	if (key === "Home") return GLOBAL_PRODUCT_MODULES[0]?.id ?? current;
	if (key === "End") return GLOBAL_PRODUCT_MODULES.at(-1)?.id ?? current;
	const delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
	if (!delta) return current;
	return GLOBAL_PRODUCT_MODULES[(index + delta + GLOBAL_PRODUCT_MODULES.length) % GLOBAL_PRODUCT_MODULES.length]?.id ?? current;
}

export function ProductWorkbench({ initialModule = "scope" }: { initialModule?: GlobalProductModuleId }) {
	const [activeId, setActiveId] = useState<GlobalProductModuleId>(initialModule);
	const tabs = useRef(new Map<GlobalProductModuleId, HTMLButtonElement>());
	const active = getGlobalProductModule(activeId);

	function select(id: GlobalProductModuleId, focus = false): void {
		setActiveId(id);
		if (focus) requestAnimationFrame(() => tabs.current.get(id)?.focus());
	}

	return (
		<GraphicFrame label="Interactive Yonaris product workbench demonstration" type="product-workbench" dark>
			<div className="global-en__workbench-tabs" role="tablist" aria-label="Choose a product module">
				{GLOBAL_PRODUCT_MODULES.map((module, index) => (
					<button
						key={module.id}
						ref={(node) => {
							if (node) tabs.current.set(module.id, node);
							else tabs.current.delete(module.id);
						}}
						id={`product-module-${module.id}`}
						type="button"
						role="tab"
						aria-selected={module.id === activeId}
						aria-controls="product-workbench-panel"
						tabIndex={module.id === activeId ? 0 : -1}
						onClick={() => select(module.id)}
						onKeyDown={(event) => {
							const next = adjacentModule(activeId, event.key);
							if (next === activeId && !["Home", "End"].includes(event.key)) return;
							event.preventDefault();
							select(next, true);
						}}
					>
						<em>{String(index + 1).padStart(2, "0")}</em>
						<span>{module.label}</span>
					</button>
				))}
			</div>
			<article
				className="global-en__workbench-panel"
				id="product-workbench-panel"
				role="tabpanel"
				aria-labelledby={`product-module-${active.id}`}
				data-module={active.id}
			>
				<div className="global-en__workbench-question">
					<small>MODULE QUESTION</small>
					<h3>{active.question}</h3>
				</div>
				<div className="global-en__workbench-record">
					<section><small>REVIEWABLE OUTPUT</small><p>{active.output}</p></section>
					<section><small>RESPONSIBILITY</small><p>{active.owner}</p></section>
					<section><small>EVIDENCE BOUNDARY</small><p>{active.boundary}</p></section>
				</div>
			</article>
			<figcaption>{disclosure}</figcaption>
		</GraphicFrame>
	);
}
