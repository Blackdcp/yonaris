import { IconInfoCircle } from "@tabler/icons-react";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useI18n } from "@/i18n/provider";

interface VisibilityTimeSeriesPoint {
	date: string;
	visibility: number | null;
}

interface VisibilityBarProps {
	currentVisibility: number;
	totalRuns: number;
	totalPrompts: number;
	totalCitations: number;
	visibilityTimeSeries: VisibilityTimeSeriesPoint[];
	lookback: string;
	isLoading?: boolean;
}

const VISIBILITY_COLORS = {
	bg: "bg-card",
	text: "text-foreground",
	border: "border-border",
	muted: "text-muted-foreground",
	stroke: "var(--yonaris-chart-focus, var(--foreground))",
	fill: "var(--yonaris-chart-focus, var(--foreground))",
};

export function VisibilityBar({
	currentVisibility,
	totalRuns,
	totalPrompts,
	totalCitations,
	visibilityTimeSeries,
	lookback,
	isLoading = false,
}: VisibilityBarProps) {
	const { t, formatNumber } = useI18n();
	if (isLoading) {
		return <VisibilityBarSkeleton />;
	}

	// Don't render if no data
	if (totalRuns === 0) {
		return null;
	}

	const colors = VISIBILITY_COLORS;
	const showChart = lookback !== "1w";

	// Prepare chart data
	const chartData = visibilityTimeSeries.map((point) => ({
		date: point.date,
		value: point.visibility ?? 0,
	}));

	return (
		<div
			className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-h-10 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border}`}
		>
			{/* Left side: visibility + chart + info */}
			<div className="flex items-center gap-2 min-w-0 shrink-0">
				<span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${colors.text}`}>
					<span data-yonaris-slot="metric-value" className="text-lg sm:text-xl">
						{formatNumber(currentVisibility)}
						<span data-yonaris-slot="metric-unit">%</span>
					</span>
					<span className="text-sm font-medium">{t("visibility.title")}</span>
				</span>

				{showChart && (
					<div className="w-24 h-6 hidden sm:block shrink-0">
						<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
							<AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
								<YAxis domain={[0, "auto"]} hide />
								<Area
									type="monotone"
									dataKey="value"
									stroke={colors.stroke}
									fill={colors.fill}
									fillOpacity={0.2}
									strokeWidth={1.5}
									dot={false}
									isAnimationActive={false}
									connectNulls
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<IconInfoCircle className={`h-3.5 w-3.5 shrink-0 ${colors.muted} cursor-help`} />
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-xs text-sm">
						{t("visibility.summaryTooltip", {
							prompts: t(totalPrompts === 1 ? "visibility.prompt.one" : "visibility.prompt.many", {
								count: formatNumber(totalPrompts),
							}),
						})}
					</TooltipContent>
				</Tooltip>
			</div>

			{/* Right side: stats */}
			<div className={`flex items-center gap-x-3 text-xs sm:text-sm ${colors.muted}`}>
				<span>
					{t(totalPrompts === 1 ? "visibility.prompt.one" : "visibility.prompt.many", {
						count: formatNumber(totalPrompts),
					})}
				</span>
				<span>
					{t(totalRuns === 1 ? "visibility.run.one" : "visibility.run.many", {
						count: formatNumber(totalRuns),
					})}
				</span>
				<span>
					{t(totalCitations === 1 ? "visibility.citation.one" : "visibility.citation.many", {
						count: formatNumber(totalCitations),
					})}
				</span>
			</div>
		</div>
	);
}

export function VisibilityBarSkeleton() {
	return (
		<div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-h-10 px-3 py-2 rounded-lg border bg-muted/30">
			<div className="flex items-center gap-3">
				<Skeleton className="h-6 sm:h-7 w-36" />
				<Skeleton className="h-6 w-24 hidden sm:block" />
			</div>
			<div className="flex items-center gap-x-3">
				<Skeleton className="h-4 sm:h-5 w-16" />
				<Skeleton className="h-4 sm:h-5 w-14" />
				<Skeleton className="h-4 sm:h-5 w-20" />
			</div>
		</div>
	);
}

export function VisibilityBarEmpty() {
	const { t } = useI18n();
	return (
		<div className="flex items-center min-h-10 px-3 py-2 rounded-lg border border-border/60 bg-muted/20">
			<span className="text-sm text-muted-foreground">{t("visibility.none")}</span>
		</div>
	);
}
