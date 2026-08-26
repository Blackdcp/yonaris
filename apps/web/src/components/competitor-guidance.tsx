import { Link } from "@tanstack/react-router";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";

export function CompetitorGuidance({
	brandId,
	canManageBrand,
	messageId = "citation.competitorInfo",
	linkClassName = "underline",
}: {
	brandId: string;
	canManageBrand: boolean;
	messageId?: Extract<MessageId, "citation.competitorInfo" | "prompt.mentionsTooltip">;
	linkClassName?: string;
}) {
	const { t } = useI18n();
	return (
		<>
			<span>{t(messageId)}</span>
			{canManageBrand ? (
				<>
					{" "}
					<Link to="/app/$brand/settings/competitors" params={{ brand: brandId }} className={linkClassName}>
						{t("citation.manageCompetitors")}
					</Link>
				</>
			) : null}
		</>
	);
}
