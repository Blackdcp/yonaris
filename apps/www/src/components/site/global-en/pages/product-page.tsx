import { GLOBAL_PRODUCT_MODULES } from "@/content/site/global-en/experience";
import { GlobalEnglishShell } from "../global-english-shell";
import { ProductWorkbench } from "../interactions/product-workbench";
import { ResponsibilityLanes, ScopeRings } from "../visuals/visuals";
import { CloseSection, PageHero, PageSection } from "./page-primitives";

export function ProductPage() {
	return (
		<GlobalEnglishShell activeKey="product">
			<PageHero
				id="scope-rings-hero"
				eyebrow="PRODUCT · EVIDENCE WORKBENCH"
				title="Make AI market answers observable."
				lead="Define the market question, inspect configured answer evidence, and choose the next reviewed test without treating AI discovery as a black box."
				visual={<ScopeRings />}
				dark
			/>
			<PageSection
				id="evidence-workbench"
				number="01"
				title="One workbench keeps every evidence state connected."
				body="Move between Scope, Answers, Evidence, and Experiments without losing the market question, owner, or boundary that gives the record meaning."
				dark
			>
				<ProductWorkbench />
			</PageSection>
			<PageSection
				id="operating-loop"
				number="02"
				eyebrow="CONNECTED BY DESIGN"
				title="Each module advances one reviewable decision."
				body="The product is not a set of disconnected dashboard pages. Each module hands an explicit artifact and boundary to the next."
			>
				<ol className="global-en__module-flow" data-graphic="product-operating-loop">
					{GLOBAL_PRODUCT_MODULES.map((module, index) => (
						<li key={module.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{module.label}</strong>
							<span>{module.output}</span>
						</li>
					))}
				</ol>
			</PageSection>
			<PageSection
				id="responsibility-lanes"
				number="03"
				title="Every handoff has an owner."
				body="System output, Yonaris review, and customer decision remain separate so a recommendation never masquerades as autonomous action."
			>
				<ResponsibilityLanes />
			</PageSection>
			<CloseSection id="request-close" title="Define the question before you collect the answer." />
		</GlobalEnglishShell>
	);
}
