"use client";

import { useEffect, useState } from "react";
import { EN_READING_RECORDS, ZH_READING_RECORDS } from "@/content/experience/canonical-public-facts";
import type { ExperienceLocale } from "@/content/experience/types";

const MAX_PROGRESS = 100;

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
		status: (progress: number) =>
			progress === MAX_PROGRESS
				? "Record structure fully revealed."
				: progress >= 50
					? "Agent reading reveals the record boundary and stable identity."
					: "Human reading keeps the public basis beside the canonical fact.",
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
		status: (progress: number) =>
			progress === MAX_PROGRESS
				? "记录结构已完整展开。"
				: progress >= 50
					? "Agent 阅读显示记录边界和稳定标识。"
					: "人类阅读把公开依据放在同一条事实旁。",
	},
} as const;

function categoryRecord(locale: ExperienceLocale) {
	const records = locale === "zh" ? ZH_READING_RECORDS : EN_READING_RECORDS;
	const record = records.find((item) => item.id === "category");
	if (!record) throw new Error("Canonical category record is unavailable");
	return record;
}

export function CanonicalRecordTransform({ locale, compact = false }: { locale: ExperienceLocale; compact?: boolean }) {
	const [progress, setProgress] = useState(0);
	const record = categoryRecord(locale);
	const copy = COPY[locale];
	const agentReading = progress >= 50;
	const complete = progress === MAX_PROGRESS;

	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		const revealFinalState = () => {
			if (preference.matches) setProgress(MAX_PROGRESS);
		};

		revealFinalState();
		preference.addEventListener("change", revealFinalState);
		return () => preference.removeEventListener("change", revealFinalState);
	}, []);

	return (
		<article
			className="site-06-canonical-record-transform"
			data-scene-object="canonical-record-transform"
			data-compact={compact || undefined}
			data-reading-state={complete ? "complete" : agentReading ? "agent" : "human"}
			aria-label={copy.label}
		>
			<p>{record.fact}</p>

			<div aria-label={copy.label}>
				<button type="button" aria-pressed={!agentReading} onClick={() => setProgress(0)}>
					{copy.human}
				</button>
				<button type="button" aria-pressed={agentReading} onClick={() => setProgress(MAX_PROGRESS)}>
					{copy.agent}
				</button>
				<label>
					<span>{copy.range}</span>
					<input
						type="range"
						min="0"
						max={MAX_PROGRESS}
						value={progress}
						aria-valuetext={copy.status(progress)}
						onChange={(event) => setProgress(Number(event.currentTarget.value))}
					/>
				</label>
			</div>

			<p aria-live="polite">{copy.status(progress)}</p>

			<dl>
				<div>
					<dt>{copy.publicBasis}</dt>
					<dd>{record.evidence}</dd>
				</div>
				<div hidden={!agentReading}>
					<dt>{copy.boundary}</dt>
					<dd>{record.boundary}</dd>
				</div>
				<div hidden={!agentReading}>
					<dt>{copy.stableIdentity}</dt>
					<dd>{record.stableId}</dd>
				</div>
				<div hidden={!complete}>
					<dt>{copy.reviewDate}</dt>
					<dd>{copy.reviewed}</dd>
				</div>
			</dl>
		</article>
	);
}
