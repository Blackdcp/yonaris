import type { UiLanguage } from "@workspace/config/language";
import { translate } from "@/i18n/catalog";
import type { OpportunitiesReason } from "@/server/opportunities";

export function opportunityEmptyMessage(reason: OpportunitiesReason, locale: UiLanguage = "en") {
	if (reason === "not_generated") {
		return translate(locale, "opportunity.empty.admin");
	}
	if (reason === "temporarily-unavailable") {
		return translate(locale, "opportunity.unavailable");
	}
	return translate(locale, "opportunity.insufficient");
}
