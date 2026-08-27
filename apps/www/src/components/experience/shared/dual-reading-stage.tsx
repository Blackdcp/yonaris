"use client";

import { useState } from "react";
import type { ReadingRecord } from "./reading-lens";
import { useRovingTabs } from "./use-roving-tabs";

type ReadingMode = "human" | "agent";
const readingModes = ["human", "agent"] as const;

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
	const [mode, setMode] = useState<ReadingMode>("human");
	const recordTabs = useRovingTabs({
		items: recordIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "site-06-dual-record",
	});
	const modeTabs = useRovingTabs({
		items: readingModes,
		active: mode,
		onChange: setMode,
		idPrefix: "site-06-dual-mode",
	});
	const activeRecord = records.find((record) => record.id === activeId) ?? records[0];

	if (!activeRecord) return null;

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
			<article
				className="site-06-dual-stage__record"
				id={activeRecord.stableId}
				data-stable-id={activeRecord.stableId}
				tabIndex={-1}
			>
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
					<p className="site-06-dual-stage__prompt">{activeRecord.prompt}</p>
					<p className="site-06-dual-stage__answer">{activeRecord.human}</p>
					<p className="site-06-dual-stage__meaning">{activeRecord.meaning}</p>
				</section>
				<section className="site-06-dual-stage__agent" {...modeTabs.getPanelProps("agent")}>
					<dl>
						<div>
							<dt>{labels.fact}</dt>
							<dd>{activeRecord.fact}</dd>
						</div>
						<div>
							<dt>{labels.evidence}</dt>
							<dd>{activeRecord.evidence}</dd>
						</div>
						<div>
							<dt>{labels.boundary}</dt>
							<dd>{activeRecord.boundary}</dd>
						</div>
						<div>
							<dt>{labels.stableId}</dt>
							<dd>
								<code>{activeRecord.stableId}</code>
							</dd>
						</div>
					</dl>
				</section>
			</article>
		</section>
	);
}
