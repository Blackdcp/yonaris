import type { DiagnosticRequestType } from "./diagnostic-schema";

export interface DiagnosticRouteSearch {
	intent?: "privacy";
}

export function validateDiagnosticRouteSearch(search: Record<string, unknown>): DiagnosticRouteSearch {
	return search.intent === "privacy" ? { intent: "privacy" } : {};
}

export function diagnosticRequestTypeFromSearch(search: string): DiagnosticRequestType {
	const intents = new URLSearchParams(search).getAll("intent");
	return intents.length === 1 && intents[0] === "privacy" ? "privacy" : "consultation";
}
