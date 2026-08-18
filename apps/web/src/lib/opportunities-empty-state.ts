import type { OpportunitiesReason } from "@/server/opportunities";

export function opportunityEmptyMessage(reason: OpportunitiesReason) {
	if (reason === "not_generated") {
		return "An administrator has not generated opportunities for this Program yet.";
	}
	return "We need a bit more tracking data before we can recommend opportunities — check back once your prompts have run for a few days.";
}
