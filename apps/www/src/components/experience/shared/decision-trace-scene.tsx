"use client";

import { useEffect, useRef, useState } from "react";
import { productDemoFor } from "@/content/experience/product-demo";
import type { ExperienceLocale } from "@/content/experience/types";
import { useRovingTabs } from "./use-roving-tabs";

const TRACE_STATES = ["observe", "compare", "inspect", "decide"] as const;

type TraceState = (typeof TRACE_STATES)[number];

const COPY: Readonly<Record<ExperienceLocale, { question: string; tablistLabel: string; relationships: Readonly<Record<TraceState, string>>; labels: Readonly<Record<TraceState, string>>; decisionNote: string }>> = {
	en: {
		question: "Which partner can support this decision?",
		tablistLabel: "Review the decision trace",
		relationships: {
			observe: "Observation",
			compare: "Comparison",
			inspect: "Evidence",
			decide: "Decision",
		},
		labels: { observe: "Observe", compare: "Compare", inspect: "Inspect", decide: "Decide" },
		decisionNote: "This sample workspace shows a review method, not a recommendation.",
	},
	zh: {
		question: "哪位合作伙伴能够支持这项决策？",
		tablistLabel: "查看决策轨迹",
		relationships: { observe: "观测", compare: "比较", inspect: "证据", decide: "决策" },
		labels: { observe: "观测", compare: "比较", inspect: "查看", decide: "决策" },
		decisionNote: "这个示例工作区展示复核方法，不构成推荐。",
	},
};

export function shouldAdvanceDecisionTrace(conditions: {
	hydrated: boolean;
	visible: boolean;
	reducedMotion: boolean;
	directlySelected: boolean;
}) {
	return conditions.hydrated && conditions.visible && !conditions.reducedMotion && !conditions.directlySelected;
}

export function DecisionTraceScene({ locale }: { locale: ExperienceLocale }) {
	const demo = productDemoFor(locale);
	const copy = COPY[locale];
	const [activeState, setActiveState] = useState<TraceState>("observe");
	const [hydrated, setHydrated] = useState(false);
	const [visible, setVisible] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);
	const [directlySelected, setDirectlySelected] = useState(false);
	const sceneRef = useRef<HTMLElement>(null);
	const tabs = useRovingTabs({
		items: TRACE_STATES,
		active: activeState,
		onChange: (next) => {
			setDirectlySelected(true);
			setActiveState(next);
		},
		idPrefix: "decision-trace",
	});

	useEffect(() => {
		setHydrated(true);
		const scene = sceneRef.current;
		if (!scene || typeof IntersectionObserver === "undefined") return;

		const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.25 });
		observer.observe(scene);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
		updateMotionPreference();
		motionQuery.addEventListener("change", updateMotionPreference);
		return () => motionQuery.removeEventListener("change", updateMotionPreference);
	}, []);

	useEffect(() => {
		if (!shouldAdvanceDecisionTrace({ hydrated, visible, reducedMotion, directlySelected })) return;

		const timer = window.setInterval(() => {
			setActiveState((current) => TRACE_STATES[(TRACE_STATES.indexOf(current) + 1) % TRACE_STATES.length] ?? current);
		}, 5000);
		return () => window.clearInterval(timer);
	}, [directlySelected, hydrated, reducedMotion, visible]);

	return (
		<section ref={sceneRef} className="site-06-decision-trace" data-scene-object="decision-trace" aria-label={copy.tablistLabel}>
			<header className="site-06-decision-trace__question">
				<p>{copy.question}</p>
			</header>

			<div className="site-06-decision-trace__rings" role="tablist" aria-label={copy.tablistLabel}>
				{TRACE_STATES.map((state, index) => (
					<div key={state} className="site-06-decision-trace__ring" data-trace-relationship={state}>
						<span>{copy.relationships[state]}</span>
						<button type="button" {...tabs.getTabProps(state, index)}>
							{copy.labels[state]}
						</button>
					</div>
				))}
			</div>

			<div className="site-06-decision-trace__facts" aria-live="polite">
				<section {...tabs.getPanelProps("observe")}>
					<h2>{copy.relationships.observe}</h2>
					<dl>
						<div>
							<dt>{demo.labels.metricLabels.visibility}</dt>
							<dd>{demo.overview.visibility}%</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.share}</dt>
							<dd>{demo.overview.share}%</dd>
						</div>
					</dl>
					<p>{demo.overview.evaluationWindow}</p>
				</section>

				<section {...tabs.getPanelProps("compare")}>
					<h2>{demo.shareOfVoice.title}</h2>
					<p>{demo.shareOfVoice.summary}</p>
					<ul>
						{demo.shareOfVoice.rows.map((row) => (
							<li key={row.brand}>{row.brand}</li>
						))}
					</ul>
				</section>

				<section {...tabs.getPanelProps("inspect")}>
					<h2>{demo.queryFanOut.title}</h2>
					<p>{demo.queryFanOut.summary}</p>
					<blockquote>{demo.queryFanOut.prompt}</blockquote>
					<dl>
						{demo.queryFanOut.lines.map((line) => (
							<div key={line.surface}>
								<dt>{line.surface}</dt>
								<dd>
									<strong>{line.status}</strong> {line.answer}
								</dd>
							</div>
						))}
					</dl>
				</section>

				<section {...tabs.getPanelProps("decide")}>
					<h2>{copy.relationships.decide}</h2>
					<p>{demo.labels.sampleWorkspace}</p>
					<p>{demo.labels.sampleData}</p>
					<p>{demo.labels.coverageBoundary}</p>
					<p>{copy.decisionNote}</p>
				</section>
			</div>
		</section>
	);
}
