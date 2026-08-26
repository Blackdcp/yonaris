/**
 * Shared fan-out UI sections, used by the Query Fan-Out page and the prompt
 * details "Web Queries" tab: variation lines with prompt-keyword bolding and
 * run counts, a per-model variations breakdown, and the Query Words section
 * (term cloud + Added/Preserved/Dropped word changes).
 */

import { IconInfoCircle } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Switch } from "@workspace/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useState } from "react";
import { YONARIS_CHART_FOCUS } from "@/brand/chart-theme";
import { ProgressBarChart } from "@/components/progress-bar-chart";
import { WordCloud } from "@/components/word-cloud";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	type FanoutQueryStat,
	type ModelFanoutStat,
	segmentQueryTextSlices,
	type TermStat,
	type WordChangeStat,
	type WordChanges,
} from "@/lib/fanout-analysis";
import { getModelDisplayName } from "@/lib/utils";

export const FANOUT_ACCENT = YONARIS_CHART_FOCUS;

export function InfoTip({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button type="button" className="cursor-help" aria-label={label}>
					<IconInfoCircle className="text-muted-foreground/60 size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs text-sm font-normal">{children}</TooltipContent>
		</Tooltip>
	);
}

/**
 * Engines that ran with web search but contributed no usable queries — they
 * searched with the prompt itself or don't reveal their searches. Purely
 * data-derived (search runs without exposed queries), so it stays correct for
 * any provider/model combination. Renders nothing when every engine exposed
 * queries.
 */
export function UnknownQueriesNote({ byModel }: { byModel: ModelFanoutStat[] }) {
	const { t, formatList } = useI18n();
	const hidden = byModel.filter((m) => m.runs > 0 && m.totalQueries === 0);
	if (hidden.length === 0) return null;
	return (
		<div className="text-muted-foreground text-xs">
			{t("prompt.fanout.hiddenQueries", {
				models: formatList(hidden.map((m) => getModelDisplayName(m.model))),
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Variations — fan-out queries with the prompt's keywords bolded + run counts
// ---------------------------------------------------------------------------

/** Per-model share of one variation's runs, shown inline as "2× ChatGPT". */
export interface VariationModelCount {
	model: string;
	count: number;
}

export function VariationLine({
	variation,
	keywords,
	modelCounts,
}: {
	variation: FanoutQueryStat;
	keywords: Set<string>;
	/** When provided, replaces the plain total with per-model counts. */
	modelCounts?: VariationModelCount[];
}) {
	const { t, formatNumber } = useI18n();
	const slices = segmentQueryTextSlices(variation.query);
	const seenSlices = new Map<string, number>();
	const renderedSlices = slices.map((slice) => {
		const occurrence = seenSlices.get(slice.text) ?? 0;
		seenSlices.set(slice.text, occurrence + 1);
		return { ...slice, key: `${slice.text}:${occurrence}` };
	});
	return (
		<div className="flex items-baseline justify-between gap-4">
			<div className="min-w-0 text-sm leading-6 break-words">
				{renderedSlices.map((slice) => (
					<span
						key={slice.key}
						className={
							slice.token && keywords.has(slice.token) ? "text-foreground font-semibold" : "text-muted-foreground"
						}
					>
						{slice.text}
					</span>
				))}
			</div>
			{modelCounts?.length ? (
				<span
					className="text-muted-foreground shrink-0 text-right text-xs tabular-nums leading-6"
					title={t("prompt.fanout.engineCountTitle")}
				>
					{modelCounts.map((mc) => `${formatNumber(mc.count)}× ${getModelDisplayName(mc.model)}`).join(" · ")}
				</span>
			) : (
				<span className="text-muted-foreground shrink-0 text-sm tabular-nums" title={t("prompt.fanout.countTitle")}>
					{formatNumber(variation.count)}×
				</span>
			)}
		</div>
	);
}

export function VariationsList({
	variations,
	keywords,
	totalUnique,
	modelCounts,
}: {
	variations: FanoutQueryStat[];
	keywords: Set<string>;
	/** Full distinct count, when `variations` is a capped slice of it. */
	totalUnique?: number;
	/** query → per-model counts, for the inline "2× ChatGPT" breakdown. */
	modelCounts?: Map<string, VariationModelCount[]>;
}) {
	const { t, formatNumber } = useI18n();
	if (variations.length === 0) {
		return <div className="text-muted-foreground py-4 text-sm">{t("prompt.fanout.empty")}</div>;
	}
	return (
		<div className="space-y-2">
			{variations.map((v) => (
				<VariationLine key={v.query} variation={v} keywords={keywords} modelCounts={modelCounts?.get(v.query)} />
			))}
			{totalUnique !== undefined && totalUnique > variations.length && (
				<div className="text-muted-foreground text-xs">
					{t("prompt.fanout.topShown", {
						shown: formatNumber(variations.length),
						total: formatNumber(totalUnique),
					})}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Query Words — the term cloud + Added / Preserved / Dropped word changes
// ---------------------------------------------------------------------------

type WordTab = "added" | "preserved" | "dropped";

const WORD_TAB_HELP: Record<WordTab, MessageId> = {
	added: "prompt.fanout.addedHelp",
	preserved: "prompt.fanout.preservedHelp",
	dropped: "prompt.fanout.droppedHelp",
};

export function QueryWordsSection({ terms, wordChanges }: { terms: TermStat[]; wordChanges: WordChanges }) {
	const { t, formatNumber } = useI18n();
	const [tab, setTab] = useState<WordTab>("added");
	const [hideStop, setHideStop] = useState(true);

	const words: WordChangeStat[] = wordChanges[tab];
	const shown = hideStop ? words.filter((w) => !w.isStop) : words;
	const help = t(WORD_TAB_HELP[tab]);
	const items = shown.slice(0, 18).map((w) => ({
		label: w.word,
		count: w.count,
		suffix: (
			<span className="text-muted-foreground tabular-nums text-xs">
				{formatNumber(w.share / 100, { style: "percent", maximumFractionDigits: 0 })}
			</span>
		),
	}));

	return (
		<div className="space-y-6">
			<Card className="py-4">
				<CardContent>
					<WordCloud terms={terms} />
				</CardContent>
			</Card>

			<Card className="gap-4">
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<CardTitle className="flex items-center gap-1.5 text-base">
								{t("prompt.fanout.wordChanges")}
								<InfoTip label={help}>{help}</InfoTip>
							</CardTitle>
							<CardDescription>{t("prompt.fanout.wordChangesDescription")}</CardDescription>
						</div>
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<Switch id="qf-hide-stop" checked={hideStop} onCheckedChange={setHideStop} />
								<label htmlFor="qf-hide-stop" className="text-muted-foreground cursor-pointer text-sm">
									{t("prompt.fanout.hideStop")}
								</label>
							</div>
							<Tabs value={tab} onValueChange={(v) => setTab(v as WordTab)}>
								<TabsList>
									<TabsTrigger value="added">{t("prompt.fanout.added")}</TabsTrigger>
									<TabsTrigger value="preserved">{t("prompt.fanout.preserved")}</TabsTrigger>
									<TabsTrigger value="dropped">{t("prompt.fanout.dropped")}</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>
				</CardHeader>
				<Separator />
				<CardContent>
					{items.length > 0 ? (
						<ProgressBarChart items={items} defaultColor={FANOUT_ACCENT} formatValue={formatNumber} />
					) : (
						<div className="text-muted-foreground py-6 text-center text-sm">
							{t(hideStop ? "prompt.fanout.emptyWordsWithStop" : "prompt.fanout.emptyWords", {
								type: t(
									tab === "added"
										? "prompt.fanout.added"
										: tab === "preserved"
											? "prompt.fanout.preserved"
											: "prompt.fanout.dropped",
								).toLowerCase(),
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
