"use client";

import { useEffect, useState } from "react";
import { EN_READING_RECORDS, ZH_READING_RECORDS } from "@/content/experience/canonical-public-facts";
import type { ExperienceLocale } from "@/content/experience/types";

const MAX_PROGRESS = 100;
const REVEAL_THRESHOLDS = {
	publicBasis: 25,
	boundary: 50,
	identityAndRepresentations: 75,
	reviewDate: MAX_PROGRESS,
} as const;

export interface CanonicalRecordRevealState {
	readonly publicBasis: boolean;
	readonly boundary: boolean;
	readonly identityAndRepresentations: boolean;
	readonly reviewDate: boolean;
}

export function canonicalRecordRevealState(progress: number): CanonicalRecordRevealState {
	return {
		publicBasis: progress >= REVEAL_THRESHOLDS.publicBasis,
		boundary: progress >= REVEAL_THRESHOLDS.boundary,
		identityAndRepresentations: progress >= REVEAL_THRESHOLDS.identityAndRepresentations,
		reviewDate: progress >= REVEAL_THRESHOLDS.reviewDate,
	};
}

export function canonicalRecordReadingProgress(reading: "human" | "agent"): number {
	return reading === "agent" ? MAX_PROGRESS : REVEAL_THRESHOLDS.publicBasis;
}

const COPY = {
	en: {
		label: "One public record for people and agents",
		human: "Human reading",
		agent: "Agent reading",
		range: "Reveal the record structure",
		publicBasis: "Public basis",
		boundary: "Boundary",
		stableIdentity: "Stable identity",
		reviewDate: "Review date",
		reviewed: "27 Aug 2026",
		representations: "Canonical representations",
		humanText: "Human text",
		agentText: "Agent text",
		markdown: "Markdown",
		retrievalBoundary:
			"Machine-readable representations support retrieval and inspection; they do not guarantee ranking, inclusion, retrieval, or citation.",
		status: (state: CanonicalRecordRevealState) =>
			state.reviewDate
				? "Record structure fully revealed for the Agent reading."
				: state.identityAndRepresentations
					? "Stable identity and canonical representations revealed."
					: state.boundary
						? "Record boundary revealed."
						: state.publicBasis
							? "Public basis revealed."
							: "Canonical fact ready for Human reading.",
	},
	zh: {
		label: "一条同时供人类和 Agent 阅读的公开记录",
		human: "人类阅读",
		agent: "Agent 阅读",
		range: "展开记录结构",
		publicBasis: "公开依据",
		boundary: "边界",
		stableIdentity: "稳定标识",
		reviewDate: "核对日期",
		reviewed: "2026 年 8 月 27 日",
		representations: "规范表示形式",
		humanText: "人类文本",
		agentText: "Agent 文本",
		markdown: "Markdown",
		retrievalBoundary: "机器可读表示支持检索与核查；但不保证排名、收录、检索或引用。",
		status: (state: CanonicalRecordRevealState) =>
			state.reviewDate
				? "记录结构已为 Agent 阅读完整展开。"
				: state.identityAndRepresentations
					? "已显示稳定标识和规范表示形式。"
					: state.boundary
						? "已显示记录边界。"
						: state.publicBasis
							? "已显示公开依据。"
							: "规范事实已准备好供人类阅读。",
	},
} as const;

function categoryRecord(locale: ExperienceLocale) {
	const records = locale === "zh" ? ZH_READING_RECORDS : EN_READING_RECORDS;
	const record = records.find((item) => item.id === "category");
	if (!record) throw new Error("Canonical category record is unavailable");
	return record;
}

function canonicalRepresentations(locale: ExperienceLocale, stableId: string) {
	const prefix = locale === "zh" ? "/zh" : "";
	return {
		human: `${prefix}/company#${stableId}`,
		agent: `${prefix}/agent/company#${stableId}`,
		markdown: `${prefix}/agent/company.md`,
	};
}

export function CanonicalRecordTransform({ locale, compact = false }: { locale: ExperienceLocale; compact?: boolean }) {
	const [progress, setProgress] = useState(() => canonicalRecordReadingProgress("human"));
	const record = categoryRecord(locale);
	const copy = COPY[locale];
	const reveal = canonicalRecordRevealState(progress);
	const status = copy.status(reveal);
	const representations = canonicalRepresentations(locale, record.stableId);

	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		const revealFinalState = () => {
			if (preference.matches) setProgress(canonicalRecordReadingProgress("agent"));
		};

		revealFinalState();
		preference.addEventListener("change", revealFinalState);
		return () => preference.removeEventListener("change", revealFinalState);
	}, []);

	return (
		<article
			className="site-06-canonical-record-transform"
			id={record.stableId}
			data-scene-object="canonical-record-transform"
			data-stable-id={record.stableId}
			data-compact={compact || undefined}
			data-reading-state={reveal.reviewDate ? "agent" : "human"}
			aria-label={copy.label}
		>
			<p>{record.fact}</p>

			<fieldset aria-label={copy.label}>
				<button
					type="button"
					aria-pressed={progress === canonicalRecordReadingProgress("human")}
					onClick={() => setProgress(canonicalRecordReadingProgress("human"))}
				>
					{copy.human}
				</button>
				<button
					type="button"
					aria-pressed={reveal.reviewDate}
					onClick={() => setProgress(canonicalRecordReadingProgress("agent"))}
				>
					{copy.agent}
				</button>
				<label>
					<span>{copy.range}</span>
					<input
						type="range"
						min="0"
						max={MAX_PROGRESS}
						value={progress}
						onChange={(event) => setProgress(Number(event.currentTarget.value))}
					/>
				</label>
			</fieldset>

			<p role="status">{status}</p>

			<dl>
				<div hidden={!reveal.publicBasis}>
					<dt>{copy.publicBasis}</dt>
					<dd>{record.evidence}</dd>
				</div>
				<div hidden={!reveal.boundary}>
					<dt>{copy.boundary}</dt>
					<dd>
						<p>{record.boundary}</p>
						<p>{copy.retrievalBoundary}</p>
					</dd>
				</div>
				<div hidden={!reveal.identityAndRepresentations}>
					<dt>{copy.stableIdentity}</dt>
					<dd>{record.stableId}</dd>
				</div>
				<div hidden={!reveal.identityAndRepresentations}>
					<dt>{copy.representations}</dt>
					<dd>
						<nav aria-label={copy.representations}>
							<a href={representations.human}>{copy.humanText}</a>
							<a href={representations.agent}>{copy.agentText}</a>
							<a href={representations.markdown} type="text/markdown">
								{copy.markdown}
							</a>
						</nav>
					</dd>
				</div>
				<div hidden={!reveal.reviewDate}>
					<dt>{copy.reviewDate}</dt>
					<dd>{copy.reviewed}</dd>
				</div>
			</dl>
		</article>
	);
}
