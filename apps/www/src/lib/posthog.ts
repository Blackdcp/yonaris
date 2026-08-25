import posthog from "posthog-js";
import { sanitizeAnalyticsProperties } from "./diagnostic-analytics-privacy";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

let initialized = false;

export function initPostHog(overrides?: { key?: string; host?: string }): void {
	if (initialized || typeof window === "undefined") return;
	const key = overrides?.key?.trim() || import.meta.env.VITE_POSTHOG_KEY?.trim();
	if (!key) return;
	const host = overrides?.host?.trim() || import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

	posthog.init(key, {
		api_host: host,
		capture_pageview: true,
		capture_pageleave: true,
		autocapture: false,
		disable_session_recording: true,
		before_send: (event) =>
			event
				? {
						...event,
						properties: sanitizeAnalyticsProperties(event.properties),
					}
				: null,
		// Prevent PostHog from auto-loading optional feature scripts we don't use.
		// Without these, /static/{surveys,dead-clicks-autocapture,web-vitals}.js
		// were being fetched even though the server returns surveys:false etc.
		disable_surveys: true,
		capture_dead_clicks: false,
		capture_performance: false,
		persistence: "localStorage+cookie",
	});

	initialized = true;
}

export function trackEvent(
	eventName: string,
	properties?: Record<string, string | number | boolean | undefined>,
): void {
	if (!initialized) return;
	posthog.capture(eventName, properties ? sanitizeAnalyticsProperties(properties) : undefined);
}
