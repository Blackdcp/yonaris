/**
 * /app/$brand/visibility - Visibility charts page
 *
 * Shows prompts with visibility scores and trend charts.
 * Data is fetched client-side via TanStack Query hooks in PromptsDisplay,
 * so no route loader is needed (allows immediate rendering with skeletons).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PromptsDisplay } from "@/components/prompts-display";
import { useBrandAccess } from "@/hooks/use-brand-access";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { coercePromptOrder, DEFAULT_PROMPT_ORDER, type PromptOrder } from "@/lib/prompt-order";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/$brand/visibility")({
	// The prompts list's sort order (#60) is this route's own search key, on top
	// of the brand-wide filter keys validated by the `$brand` layout route. The
	// default order is omitted so default state keeps a clean URL.
	validateSearch: (search: Record<string, unknown>): { order?: PromptOrder } => {
		const order = coercePromptOrder(search.order);
		return order === DEFAULT_PROMPT_ORDER ? {} : { order };
	},
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "visibility.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "visibility.meta.description") },
			],
		};
	},
	component: VisibilityPage,
});

function VisibilityPage() {
	const { brand: brandId } = Route.useParams();
	const { canManageBrand } = useBrandAccess();
	const { t } = useI18n();

	const infoContent = (
		<>
			{t("visibility.infoPrefix")}{" "}
			{canManageBrand ? (
				<Link to="/app/$brand/settings/competitors" params={{ brand: brandId }} className="underline">
					{t("visibility.competitors")}
				</Link>
			) : (
				t("visibility.competitors")
			)}
			.
		</>
	);

	return (
		<PromptsDisplay
			exportLanguageSurface="visibility-chart-export"
			pageTitle={t("visibility.title")}
			pageDescription={t("visibility.description")}
			pageInfoContent={infoContent}
			editLink={canManageBrand ? `/app/${brandId}/settings/prompts` : undefined}
		/>
	);
}
