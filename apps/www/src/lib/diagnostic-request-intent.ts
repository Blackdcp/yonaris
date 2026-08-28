import { useEffect, useSyncExternalStore } from "react";
import type { DiagnosticRequestType } from "./diagnostic-schema";

export interface DiagnosticRouteSearch {
	intent?: "privacy";
}

export const DIAGNOSTIC_INTENT_STATE_KEY = "__yonarisDiagnosticIntent";
export const DIAGNOSTIC_HYDRATION_INTENT_STATE_KEY = "__yonarisDiagnosticHydrationIntent";

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

function diagnosticRequestTypeFromHydrationSnapshot(
	search: Record<string, unknown>,
	state: unknown,
): DiagnosticRequestType {
	const hydrationIntent =
		typeof state === "object" && state !== null
			? (state as Record<string, unknown>)[DIAGNOSTIC_HYDRATION_INTENT_STATE_KEY]
			: undefined;
	return search.intent === "privacy" || hydrationIntent === "privacy" ? "privacy" : "consultation";
}

export function useDiagnosticRequestType(search: Record<string, unknown>): DiagnosticRequestType {
	const requestType = useSyncExternalStore(
		subscribeToDiagnosticIntent,
		() => diagnosticRequestTypeFromRoute(search, window.history.state),
		() =>
			diagnosticRequestTypeFromHydrationSnapshot(
				search,
				typeof window === "undefined" ? null : window.history.state,
			),
	);
	useEffect(() => {
		const state = window.history.state;
		if (state?.[DIAGNOSTIC_HYDRATION_INTENT_STATE_KEY] !== "privacy") return;
		const nextState = { ...state };
		delete nextState[DIAGNOSTIC_HYDRATION_INTENT_STATE_KEY];
		window.history.replaceState(nextState, "");
	}, []);
	return requestType;
}
