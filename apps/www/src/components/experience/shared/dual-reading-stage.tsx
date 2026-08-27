"use client";

import { useState } from "react";
import type { ReadingRecord } from "./reading-lens";
import { useRovingTabs } from "./use-roving-tabs";

type ReadingMode = "human" | "agent";
const readingModes = ["human", "agent"] as const;

function DualReadingRecord({ record, locale }: { record: ReadingRecord; locale: "en" | "zh" }) {
	const [mode, setMode] = useState<ReadingMode>("human");
	const modeTabs = useRovingTabs({
		items: readingModes,
		active: mode,
		onChange: setMode,
		idPrefix: `site-06-dual-mode-${record.id}`,
	});
	const labels =
		locale === "en"
			? {
					human: "Human reading",
					agent: "Agent reading",
					fact: "Fact",
					evidence: "Evidence",
					boundary: "Boundary",
					stableId: "Stable ID",
				}
			: {
					human: "人类阅读",
					agent: "Agent 阅读",
					fact: "事实",
					evidence: "证据",
					boundary: "边界",
					stableId: "稳定 ID",
				};

	return (
		<article className="site-06-dual-stage__record" id={record.stableId} data-stable-id={record.stableId} tabIndex={-1}>
			<div
				className="site-06-dual-stage__modes"
				role="tablist"
				aria-label={locale === "en" ? "Choose a reading" : "选择阅读方式"}
			>
				{readingModes.map((item, index) => (
					<button key={item} type="button" {...modeTabs.getTabProps(item, index)}>
						{labels[item]}
					</button>
				))}
			</div>
			<section className="site-06-dual-stage__human" {...modeTabs.getPanelProps("human")}>
				<p className="site-06-dual-stage__prompt">{record.prompt}</p>
				<p className="site-06-dual-stage__answer">{record.human}</p>
				<p className="site-06-dual-stage__meaning">{record.meaning}</p>
			</section>
			<section className="site-06-dual-stage__agent" {...modeTabs.getPanelProps("agent")}>
				<dl>
					<div>
						<dt>{labels.fact}</dt>
						<dd>{record.fact}</dd>
					</div>
					<div>
						<dt>{labels.evidence}</dt>
						<dd>{record.evidence}</dd>
					</div>
					<div>
						<dt>{labels.boundary}</dt>
						<dd>{record.boundary}</dd>
					</div>
					<div>
						<dt>{labels.stableId}</dt>
						<dd>
							<code>{record.stableId}</code>
						</dd>
					</div>
				</dl>
			</section>
		</article>
	);
}

export function DualReadingStage({
	locale,
	heading,
	description,
	records,
	initialId,
}: {
	locale: "en" | "zh";
	heading: string;
	description?: string;
	records: readonly ReadingRecord[];
	initialId: string;
}) {
	const recordIds = records.map((record) => record.id);
	const fallbackId = records.some((record) => record.id === initialId) ? initialId : (recordIds[0] ?? initialId);
	const [activeId, setActiveId] = useState(fallbackId);
	const recordTabs = useRovingTabs({
		items: recordIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "site-06-dual-record",
	});

	if (records.length === 0) return null;

	return (
		<section className="site-06-dual-stage" data-scene-object="dual-reading-stage">
			<header className="site-06-dual-stage__copy">
				<h2>{heading}</h2>
				{description ? <p>{description}</p> : null}
				<div
					className="site-06-dual-stage__records"
					role="tablist"
					aria-label={locale === "en" ? "Choose a public fact" : "选择公开事实"}
				>
					{records.map((record, index) => (
						<button key={record.id} type="button" {...recordTabs.getTabProps(record.id, index)}>
							{record.prompt}
						</button>
					))}
				</div>
			</header>
			{records.map((record) => (
				<section key={record.id} className="site-06-dual-stage__panel" {...recordTabs.getPanelProps(record.id)}>
					<DualReadingRecord record={record} locale={locale} />
				</section>
			))}
		</section>
	);
}
