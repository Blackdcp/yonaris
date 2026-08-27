"use client";

import { type FocusEvent, useEffect, useRef, useState } from "react";
import { productDemoFor } from "@/content/experience/product-demo";
import type { ExperienceLocale } from "@/content/experience/types";
import { useRovingTabs } from "./use-roving-tabs";

const TRACE_STATES = ["observe", "compare", "inspect", "decide"] as const;

type TraceState = (typeof TRACE_STATES)[number];

interface DecisionTraceCopy {
	readonly question: string;
	readonly tablistLabel: string;
	readonly relationships: Readonly<Record<TraceState, string>>;
	readonly labels: Readonly<Record<TraceState, string>>;
	readonly evidenceGap: string;
	readonly observationBoundary: string;
	readonly nextAction: string;
	readonly comparableRetest: string;
	readonly decisionNote: string;
}

const COPY: Readonly<Record<ExperienceLocale, DecisionTraceCopy>> = {
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
		evidenceGap:
			"Public evidence gap: The selected buying question lacks a directly matched public comparison source in this sample.",
		observationBoundary:
			"Selected observation boundary: The selected market, language, engine, tracked prompt, observation target, and 30-day window.",
		nextAction: "Next action: Review one public comparison brief for the selected buying question.",
		comparableRetest:
			"Comparable retest: Run the same question against the same tracked comparison set and observation boundary.",
		decisionNote: "This sample workspace shows a review method, not a recommendation.",
	},
	zh: {
		question: "哪位合作伙伴能够支持这项决策？",
		tablistLabel: "查看决策轨迹",
		relationships: { observe: "观测", compare: "比较", inspect: "证据", decide: "决策" },
		labels: { observe: "观测", compare: "比较", inspect: "查看", decide: "决策" },
		evidenceGap: "公开证据缺口：这个示例中的采购问题缺少直接匹配的公开对比来源。",
		observationBoundary: "选定观测边界：选定市场、语言、引擎、跟踪问题、观测目标和 30 天时间窗。",
		nextAction: "下一步行动：针对选定采购问题复核一份公开对比说明。",
		comparableRetest: "可比复测：使用相同跟踪对比组和观测边界再次运行同一问题。",
		decisionNote: "这个示例工作区展示复核方法，不构成推荐。",
	},
};

export function shouldAdvanceDecisionTrace(conditions: {
	hydrated: boolean;
	visible: boolean;
	reducedMotion: boolean;
	directlySelected: boolean;
	focusWithin: boolean;
}) {
	return (
		conditions.hydrated &&
		conditions.visible &&
		!conditions.reducedMotion &&
		!conditions.directlySelected &&
		!conditions.focusWithin
	);
}

export function DecisionTraceScene({ locale }: { locale: ExperienceLocale }) {
	const demo = productDemoFor(locale);
	const copy = COPY[locale];
	const [activeState, setActiveState] = useState<TraceState>("observe");
	const [hydrated, setHydrated] = useState(false);
	const [visible, setVisible] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);
	const [directlySelected, setDirectlySelected] = useState(false);
	const [focusWithin, setFocusWithin] = useState(false);
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

		const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
			threshold: 0.25,
		});
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
		if (!shouldAdvanceDecisionTrace({ hydrated, visible, reducedMotion, directlySelected, focusWithin })) return;

		const timer = window.setInterval(() => {
			setActiveState((current) => TRACE_STATES[(TRACE_STATES.indexOf(current) + 1) % TRACE_STATES.length] ?? current);
		}, 5000);
		return () => window.clearInterval(timer);
	}, [directlySelected, focusWithin, hydrated, reducedMotion, visible]);

	const handleBlur = (event: FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
	};

	return (
		<section
			ref={sceneRef}
			className="site-06-decision-trace"
			data-scene-object="decision-trace"
			aria-label={copy.tablistLabel}
			onFocusCapture={() => setFocusWithin(true)}
			onBlurCapture={handleBlur}
		>
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

			<div className="site-06-decision-trace__facts">
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
						<div>
							<dt>{demo.labels.metricLabels.prompts}</dt>
							<dd>{demo.overview.prompts}</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.evaluations}</dt>
							<dd>{new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US").format(demo.overview.evaluations)}</dd>
						</div>
					</dl>
					<p>{demo.overview.evaluationWindow}</p>
					<p>{demo.overview.frequencyNote}</p>
				</section>

				<section {...tabs.getPanelProps("compare")}>
					<h2>{demo.shareOfVoice.title}</h2>
					<p>{demo.shareOfVoice.summary}</p>
					<p>
						{locale === "zh"
							? `${demo.labels.metricLabels.share}：${demo.overview.share}%`
							: `${demo.labels.metricLabels.share}: ${demo.overview.share}%`}
					</p>
					<ol>
						{demo.shareOfVoice.rows.map((row) => (
							<li key={row.brand}>{row.brand}</li>
						))}
					</ol>
				</section>

				<section {...tabs.getPanelProps("inspect")}>
					<h2>{copy.relationships.inspect}</h2>
					<p>{copy.evidenceGap}</p>
					<p>{copy.observationBoundary}</p>
				</section>

				<section {...tabs.getPanelProps("decide")}>
					<h2>{copy.relationships.decide}</h2>
					<p>{demo.labels.sampleWorkspace}</p>
					<p>{demo.labels.sampleData}</p>
					<p>{copy.nextAction}</p>
					<p>{copy.comparableRetest}</p>
					<p>{copy.decisionNote}</p>
				</section>
			</div>
		</section>
	);
}
