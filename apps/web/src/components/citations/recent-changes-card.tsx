import {
	IconArrowDownRight,
	IconExternalLink,
	IconInfoCircle,
	IconPlus,
	IconSwitchHorizontal,
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useMemo, useState } from "react";
import { formatUrlForDisplay, UnderlineTabs } from "@/components/citations/shared";
import type { CitationData } from "@/components/citations/types";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";

type ChangeType = "new_pages" | "dropped_pages" | "title" | "new_domains" | "dropped_domains";

const CHANGE_TYPE_MESSAGE_IDS: Record<ChangeType, MessageId> = {
	new_pages: "citation.changes.newPages",
	dropped_pages: "citation.changes.droppedPages",
	title: "citation.changes.title",
	new_domains: "citation.changes.newDomains",
	dropped_domains: "citation.changes.droppedDomains",
};

export function RecentChangesCard({
	whatsChanged,
	days,
}: {
	whatsChanged: NonNullable<CitationData["whatsChanged"]>;
	days: number;
}) {
	const { t, formatNumber } = useI18n();
	const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeType>("new_pages");
	const period = t("citation.period", { count: formatNumber(days) });
	const changeTypeTabs = Object.entries(CHANGE_TYPE_MESSAGE_IDS).map(([key, id]) => ({
		key: key as ChangeType,
		label: t(id),
	}));

	const allChanges = useMemo(() => {
		return [
			...whatsChanged.newUrls.map((u) => ({ type: "new_pages" as const, ...u })),
			...whatsChanged.droppedUrls.map((u) => ({ type: "dropped_pages" as const, ...u })),
			...whatsChanged.titleChanges.map((u) => ({ type: "title" as const, ...u })),
			...whatsChanged.newDomains.map((d) => ({ type: "new_domains" as const, ...d })),
			...whatsChanged.droppedDomains.map((d) => ({ type: "dropped_domains" as const, ...d })),
		];
	}, [whatsChanged]);

	const filteredChanges = useMemo(() => {
		return allChanges.filter((c) => c.type === changeTypeFilter);
	}, [allChanges, changeTypeFilter]);

	const visibleChanges = filteredChanges.slice(0, 6);

	return (
		<Card className="h-full flex flex-col">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5">
					{t("citation.recentChanges")}
					<Tooltip>
						<TooltipTrigger asChild>
							<IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
						</TooltipTrigger>
						<TooltipContent className="max-w-xs text-sm font-normal">
							{t("citation.changesTooltip", { period })}
						</TooltipContent>
					</Tooltip>
				</CardTitle>
				<CardDescription>{t("citation.changesDescription", { period })}</CardDescription>
			</CardHeader>
			<Separator />
			<CardContent className="flex-1">
				<UnderlineTabs
					tabs={changeTypeTabs}
					activeKey={changeTypeFilter}
					onSelect={(key) => setChangeTypeFilter(key)}
				/>
				<div className="divide-y divide-border/50">
					{visibleChanges.map((change) => {
						const isDomainChange = change.type === "new_domains" || change.type === "dropped_domains";
						const rawUrl = "url" in change ? (change.url as string) : undefined;
						const domain = "domain" in change ? (change.domain as string) : undefined;
						const url = rawUrl ?? (isDomainChange && domain ? `https://${domain}` : undefined);
						const displayLabel = isDomainChange ? (domain ?? "") : rawUrl ? formatUrlForDisplay(rawUrl) : "";
						const key = isDomainChange ? `${change.type}-${domain}` : `${change.type}-${url ?? ""}`;

						const icon =
							change.type === "new_pages" || change.type === "new_domains" ? (
								<IconPlus className="h-3.5 w-3.5 text-green-600" />
							) : change.type === "dropped_pages" || change.type === "dropped_domains" ? (
								<IconArrowDownRight className="h-3.5 w-3.5 text-red-600" />
							) : (
								<IconSwitchHorizontal className="h-3.5 w-3.5 text-amber-600" />
							);

						let description: React.ReactNode = null;
						if (change.type === "new_pages" && "promptCount" in change) {
							description = t("citation.changes.newPageRow", {
								citations: t(change.count === 1 ? "citation.citation.one" : "citation.citation.many", {
									count: formatNumber(change.count),
								}),
								prompts: t(change.promptCount === 1 ? "visibility.prompt.one" : "visibility.prompt.many", {
									count: formatNumber(change.promptCount),
								}),
							});
						} else if (change.type === "dropped_pages" && "previousCount" in change) {
							description = t("citation.changes.droppedPageRow", {
								previous: formatNumber(change.previousCount),
								current: formatNumber(change.currentCount),
							});
						} else if (change.type === "title" && "currentTitle" in change && "previousTitle" in change) {
							description = (
								<>
									<span className="line-through opacity-60">{change.previousTitle}</span>
									{" → "}
									<span className="font-medium text-foreground">{change.currentTitle}</span>
								</>
							);
						} else if (change.type === "new_domains" && "count" in change) {
							description = t("citation.changes.newDomainRow", {
								citations: t(change.count === 1 ? "citation.citation.one" : "citation.citation.many", {
									count: formatNumber(change.count),
								}),
							});
						} else if (change.type === "dropped_domains" && "previousCount" in change) {
							description = t("citation.changes.droppedDomainRow", {
								citations: t(change.previousCount === 1 ? "citation.citation.one" : "citation.citation.many", {
									count: formatNumber(change.previousCount),
								}),
							});
						}

						const inner = (
							<>
								<div className="shrink-0 mt-0.5">{icon}</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span
											className={`text-sm font-medium truncate text-foreground${url ? " group-hover:underline" : ""}`}
										>
											{displayLabel}
										</span>
										{url && (
											<IconExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
										)}
									</div>
									{description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
								</div>
							</>
						);

						return (
							<a
								key={key}
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-start gap-2.5 py-2 group"
							>
								{inner}
							</a>
						);
					})}
					{visibleChanges.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-4">{t("citation.changes.empty")}</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
