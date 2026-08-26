import { IconInfoCircle } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useI18n } from "@/i18n/provider";

function StatCard({ title, tooltip, value }: { title: string; tooltip: React.ReactNode; value: React.ReactNode }) {
	return (
		<Card data-yonaris-slot="metric-card" className="flex flex-col">
			<CardHeader className="gap-0">
				<CardTitle data-yonaris-slot="metric-label" className="flex items-center gap-1.5">
					{title}
					<Tooltip>
						<TooltipTrigger asChild>
							<IconInfoCircle className="h-3.5 w-3.5 cursor-help" />
						</TooltipTrigger>
						<TooltipContent className="max-w-xs text-sm font-normal">{tooltip}</TooltipContent>
					</Tooltip>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 flex items-center">
				<div data-yonaris-slot="metric-value" className="text-2xl sm:text-3xl lg:text-4xl">
					{value}
				</div>
			</CardContent>
		</Card>
	);
}

export function CitationStatsCards({
	brandShare,
	uniqueDomains,
	totalCitations,
}: {
	brandShare: number;
	uniqueDomains: number;
	totalCitations: number;
}) {
	const { t, formatNumber } = useI18n();
	return (
		<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<StatCard
				title={t("citation.brandShare")}
				tooltip={t("citation.stats.brandTooltip")}
				value={`${formatNumber(brandShare)}%`}
			/>
			<StatCard
				title={t("citation.uniqueDomains")}
				tooltip={t("citation.stats.domainsTooltip")}
				value={formatNumber(uniqueDomains)}
			/>
			{/* Kept deliberately simple: the user doesn't need the Google AI Mode
			    search/shopping nuance. Those surfaces aren't citations in the
			    traditional sense (they point back into Google's own product/search
			    results, not an external domain w.r.t. the model), so they're
			    excluded from this count and broken out in the Google Shopping card. */}
			<StatCard
				title={t("citation.total")}
				tooltip={t("citation.stats.totalTooltip")}
				value={formatNumber(totalCitations)}
			/>
		</div>
	);
}
