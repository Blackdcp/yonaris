import { IconInfoCircle, IconSearch } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useMemo, useState } from "react";
import { UnderlineTabs } from "@/components/citations/shared";
import { TrackDomainPopover } from "@/components/citations/track-domain-popover";
import type { CitationData } from "@/components/citations/types";
import { ListPagination, usePagedList } from "@/components/list-pagination";
import { DOMAIN_CATEGORY_COLORS, ProgressBarChart } from "@/components/progress-bar-chart";
import { useI18n } from "@/i18n/provider";

export function TopDomainsCard({
	domains,
	sourceTabs,
	maxDomains,
	brandId,
	brandName,
	competitors,
	canManageBrand = true,
	onCompetitorAdded,
}: {
	domains: CitationData["domainDistribution"];
	sourceTabs: { key: string; label: string }[];
	maxDomains: number;
	brandId?: string;
	brandName?: string;
	competitors?: CitationData["competitors"];
	canManageBrand?: boolean;
	onCompetitorAdded?: () => void;
}) {
	const { t } = useI18n();
	const [domainSearch, setDomainSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	const filteredDomains = useMemo(() => {
		let result = domains;
		if (selectedCategory !== "all") {
			result = result.filter((d) => d.category === selectedCategory);
		}
		if (domainSearch) {
			const q = domainSearch.toLowerCase();
			result = result.filter((d) => d.domain.toLowerCase().includes(q));
		}
		return result;
	}, [domains, selectedCategory, domainSearch]);

	const { page, setPage, pageItems, totalItems } = usePagedList(filteredDomains, maxDomains);

	return (
		<Card className="gap-4">
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div className="space-y-1 min-w-0">
						<CardTitle className="flex items-center gap-1.5">
							{t("citation.topDomains")}
							<Tooltip>
								<TooltipTrigger asChild>
									<IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent className="max-w-xs text-sm font-normal">{t("citation.domainsTooltip")}</TooltipContent>
							</Tooltip>
						</CardTitle>
						<CardDescription>{t("citation.domainsDescription")}</CardDescription>
					</div>
					<div className="relative w-full sm:w-48 shrink-0">
						<IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder={t("citation.searchDomains")}
							value={domainSearch}
							onChange={(e) => {
								setDomainSearch(e.target.value);
								setPage(0);
							}}
							className="h-8 pl-8 text-xs"
						/>
					</div>
				</div>
			</CardHeader>
			<Separator />
			<CardContent>
				{sourceTabs.length > 2 && (
					<div className="mb-3">
						<UnderlineTabs
							tabs={sourceTabs}
							activeKey={selectedCategory}
							onSelect={(key) => {
								setSelectedCategory(key);
								setPage(0);
							}}
						/>
					</div>
				)}
				{/* The card itself is gated on the UNFILTERED list by the parent;
				    only the rows react to the search/tab filters, so a no-match
				    search shows this message instead of hiding the section (#322). */}
				{filteredDomains.length > 0 ? (
					<>
						<ProgressBarChart
							items={pageItems.map((domain) => ({
								label: domain.domain,
								count: domain.count,
								category: domain.category || "other",
								action:
									domain.category === "other" && brandId && competitors && canManageBrand ? (
										<TrackDomainPopover
											domain={domain.domain}
											brandId={brandId}
											brandName={brandName}
											competitors={competitors}
											onAdded={onCompetitorAdded}
										/>
									) : undefined,
							}))}
							colorMapping={DOMAIN_CATEGORY_COLORS}
							percentageMode="max"
						/>
						<ListPagination page={page} pageSize={maxDomains} totalItems={totalItems} onPageChange={setPage} />
					</>
				) : (
					<p className="text-sm text-muted-foreground text-center py-4">{t("citation.emptyDomains")}</p>
				)}
			</CardContent>
		</Card>
	);
}
