/**
 * /app/$brand/opportunities — AI-generated opportunities.
 *
 * The page renders a structured opportunities report. We assemble a deterministic
 * digest of the brand's tracked citation data (per-query standing vs the leading
 * competitor over 7d + 30d, citation difficulty, where answers are sourced, and
 * per-platform visibility). Customer requests only read the persisted report;
 * generation and refresh are explicit platform operations.
 */

import { IconClock, IconLoader2 } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { OpportunitiesReport } from "@/components/opportunities-report";
import { PageHeader } from "@/components/page-header";
import { useBrand } from "@/hooks/use-brands";
import { useListFilters } from "@/hooks/use-list-filters";
import { useOpportunities } from "@/hooks/use-opportunities";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { opportunityEmptyMessage } from "@/lib/opportunities-empty-state";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/$brand/opportunities")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "opportunity.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "opportunity.meta.description") },
			],
		};
	},
	component: OpportunitiesPage,
});

function OpportunitiesPage() {
	const { t, locale } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { brand } = useBrand(brandId);
	const { scopeId, isScopeResolving } = useListFilters();
	const { data, isLoading, isError } = useOpportunities(brandId, scopeId);

	const infoContent = t("opportunity.info");

	let content: React.ReactNode;
	if (brand === undefined || isScopeResolving) {
		content = <LoadingState />;
	} else if (!scopeId) {
		content = <EmptyCard>{t("opportunity.noScope")}</EmptyCard>;
	} else if (isLoading) {
		content = <LoadingState />;
	} else if (isError) {
		content = <EmptyCard>{t("opportunity.error")}</EmptyCard>;
	} else if (!data || data.reason === "insufficient-data" || data.reason === "not_generated" || !data.report) {
		content = <EmptyCard>{opportunityEmptyMessage(data?.reason ?? "insufficient-data", locale)}</EmptyCard>;
	} else {
		content = <OpportunitiesReport report={data.report} brandId={brandId} />;
	}

	return (
		<PageHeader title={t("opportunity.title")} subtitle={t("opportunity.description")} infoContent={infoContent}>
			<div className="space-y-6">
				{data?.report && data.lastEvaluatedAt && <LastEvaluatedAt date={data.lastEvaluatedAt} />}
				{content}
			</div>
		</PageHeader>
	);
}

function LastEvaluatedAt({ date }: { date: string }) {
	const { t, formatDate } = useI18n();
	const formattedDate = formatDate(new Date(date), { month: "long", day: "numeric", year: "numeric" });
	return (
		<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
			<IconClock className="size-4" aria-hidden />
			<time dateTime={date}>{t("opportunity.lastEvaluated", { date: formattedDate })}</time>
		</p>
	);
}

function EmptyCard({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-border">
			<p className="px-6 py-10 text-center text-sm text-muted-foreground">{children}</p>
		</div>
	);
}

function LoadingState() {
	const { t } = useI18n();
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<IconLoader2 className="size-4 animate-spin" />
				{t("opportunity.loading")}
			</div>
			<div className="space-y-2">
				<Skeleton className="h-6 w-2/3" />
				<Skeleton className="h-4 w-full max-w-[70ch]" />
				<Skeleton className="h-4 w-1/2" />
			</div>
			<div className="space-y-3">
				{[0, 1, 2].map((i) => (
					<Skeleton key={i} className="h-28 w-full rounded-xl" />
				))}
			</div>
		</div>
	);
}
