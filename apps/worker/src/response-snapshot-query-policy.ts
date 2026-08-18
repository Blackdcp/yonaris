import { WEB_QUERIES_UNAVAILABLE } from "@workspace/lib/constants";
import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";

export function normalizeResponseSnapshotQueryEvidence(input: {
	webQueries: string[];
	webSearchEnabled: boolean;
}): Pick<ResponseSnapshotDraft, "webQueries" | "queryAvailability"> {
	const exposedQueries = input.webQueries.filter((query) => query !== WEB_QUERIES_UNAVAILABLE);
	if (!input.webSearchEnabled) return { webQueries: [], queryAvailability: "not_applicable" };
	if (input.webQueries.includes(WEB_QUERIES_UNAVAILABLE) || exposedQueries.length === 0) {
		return { webQueries: [], queryAvailability: "unavailable" };
	}
	return { webQueries: exposedQueries, queryAvailability: "available" };
}
