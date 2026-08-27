import { useSyncExternalStore } from "react";
import type { DiagnosticRequestType } from "./diagnostic-schema";

export interface DiagnosticRouteSearch {
	intent?: "privacy";
}

export const DIAGNOSTIC_INTENT_STATE_KEY = "__yonarisDiagnosticIntent";

export function validateDiagnosticRouteSearch(search: Record<string, unknown>): DiagnosticRouteSearch {
	return search.intent === "privacy" ? { intent: "privacy" } : {};
}

export function diagnosticRequestTypeFromRoute(
	search: Record<string, unknown>,
	state: unknown,
): DiagnosticRequestType {
	const stateIntent =
		typeof state === "object" && state !== null
			? (state as Record<string, unknown>)[DIAGNOSTIC_INTENT_STATE_KEY]
			: undefined;
	return search.intent === "privacy" || stateIntent === "privacy"
		? "privacy"
		: "consultation";
}

const subscribeToDiagnosticIntent = () => () => undefined;

export function useDiagnosticRequestType(search: Record<string, unknown>): DiagnosticRequestType {
	const serverRequestType = diagnosticRequestTypeFromRoute(search, null);
	return useSyncExternalStore(
		subscribeToDiagnosticIntent,
		() => diagnosticRequestTypeFromRoute(search, window.history.state),
		() => serverRequestType,
	);
}
