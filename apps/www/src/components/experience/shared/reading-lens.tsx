import { useEffect, useState } from "react";
import { useRovingTabs } from "./use-roving-tabs";

export interface ReadingRecord {
	readonly id: string;
	readonly prompt: string;
	readonly human: string;
	readonly meaning: string;
	readonly fact: string;
	readonly evidence: string;
	readonly boundary: string;
	readonly stableId: string;
}

type ReadingMode = "human" | "agent";

const readingModes = ["human", "agent"] as const;

interface ReadingHashTarget {
	readonly location: { readonly hash: string };
	addEventListener(type: "hashchange", listener: () => void): void;
	removeEventListener(type: "hashchange", listener: () => void): void;
}

export function bindReadingLensHash({
	target,
	records,
	onSelect,
	onReveal,
	schedule = (callback) => globalThis.setTimeout(callback, 0),
}: {
	target: ReadingHashTarget;
	records: readonly Pick<ReadingRecord, "id" | "stableId">[];
	onSelect: (id: string) => void;
	onReveal: (stableId: string) => void;
	schedule?: (callback: () => void) => void;
}): () => void {
	const selectFromHash = () => {
		let stableId = target.location.hash.replace(/^#/, "");
		try {
			stableId = decodeURIComponent(stableId);
		} catch {
			return;
		}
		const record = records.find((item) => item.stableId === stableId);
		if (!record) return;
		onSelect(record.id);
		schedule(() => onReveal(record.stableId));
	};

	target.addEventListener("hashchange", selectFromHash);
	selectFromHash();
	return () => target.removeEventListener("hashchange", selectFromHash);
}

function RecordReading({ record, locale }: { record: ReadingRecord; locale: "en" | "zh" }) {
	const [mode, setMode] = useState<ReadingMode>("human");
	const tabs = useRovingTabs({
		items: readingModes,
		active: mode,
		onChange: setMode,
		idPrefix: `reading-${record.id}`,
	});
	const labels =
		locale === "en"
			? {
					human: "For people",
					agent: "For agents",
					fact: "Fact",
					context: "Human context",
					meaning: "Decision meaning",
					evidence: "Evidence",
					boundary: "Boundary",
					stableId: "Stable ID",
				}
			: {
					human: "人类阅读",
					agent: "Agent 阅读",
					fact: "事实",
					context: "人类语境",
					meaning: "决策含义",
					evidence: "证据",
					boundary: "边界",
					stableId: "稳定 ID",
				};

	return (
		<article className="site-06-reading__record" id={record.stableId} data-stable-id={record.stableId} tabIndex={-1}>
			<div className="site-06-tabs" role="tablist" aria-label={locale === "en" ? "Choose a reading" : "选择阅读方式"}>
				{readingModes.map((item, index) => (
					<button key={item} type="button" {...tabs.getTabProps(item, index)}>
						{labels[item]}
					</button>
				))}
			</div>
			<section className="site-06-reading__panel" {...tabs.getPanelProps("human")}>
				<dl>
					<div>
						<dt>{labels.fact}</dt>
						<dd>{record.fact}</dd>
					</div>
					<div>
						<dt>{labels.context}</dt>
						<dd>{record.human}</dd>
					</div>
					<div>
						<dt>{labels.meaning}</dt>
						<dd>{record.meaning}</dd>
					</div>
					<div>
						<dt>{labels.evidence}</dt>
						<dd>{record.evidence}</dd>
					</div>
					<div>
						<dt>{labels.boundary}</dt>
						<dd>{record.boundary}</dd>
					</div>
				</dl>
			</section>
			<section className="site-06-reading__panel site-06-reading__panel--agent" {...tabs.getPanelProps("agent")}>
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

export function ReadingLens({
	locale,
	records,
	initialId,
}: {
	locale: "en" | "zh";
	records: readonly ReadingRecord[];
	initialId: string;
}) {
	const recordIds = records.map((record) => record.id);
	const fallbackId = records.some((record) => record.id === initialId) ? initialId : (recordIds[0] ?? initialId);
	const [activeId, setActiveId] = useState(fallbackId);
	const tabs = useRovingTabs({ items: recordIds, active: activeId, onChange: setActiveId, idPrefix: "reading-record" });

	useEffect(() => {
		if (typeof window === "undefined") return;
		return bindReadingLensHash({
			target: window,
			records,
			onSelect: setActiveId,
			onReveal: (stableId) => {
				const target = document.getElementById(stableId);
				if (!target) return;
				target.focus({ preventScroll: true });
				target.scrollIntoView({ block: "start" });
			},
		});
	}, [records]);

	if (records.length === 0) return null;

	return (
		<section className="site-06-reading" aria-label={locale === "en" ? "Read public facts" : "阅读公开事实"}>
			<div
				className="site-06-reading__prompts"
				role="tablist"
				aria-label={locale === "en" ? "Choose a public fact" : "选择公开事实"}
			>
				{records.map((record, index) => (
					<button key={record.id} type="button" {...tabs.getTabProps(record.id, index)}>
						{record.prompt}
					</button>
				))}
			</div>
			{records.map((record) => (
				<section key={record.id} className="site-06-reading__fact" {...tabs.getPanelProps(record.id)}>
					<RecordReading record={record} locale={locale} />
				</section>
			))}
		</section>
	);
}
