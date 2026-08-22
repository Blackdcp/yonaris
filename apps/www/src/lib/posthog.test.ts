import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
	capture: vi.fn(),
	identify: vi.fn(),
	init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

describe("PostHog privacy boundary", () => {
	beforeEach(() => {
		posthog.capture.mockReset();
		posthog.identify.mockReset();
		posthog.init.mockReset();
		vi.resetModules();
	});

	it("sanitizes automatic page URL and referrer properties before transport", async () => {
		vi.stubGlobal("window", {});
		const { initPostHog } = await import("./posthog");
		initPostHog({ key: "phc_test", host: "http://127.0.0.1:3002/test-posthog" });

		const config = posthog.init.mock.calls[0]?.[1] as {
			before_send?: (event: { properties: Record<string, unknown> }) => { properties: Record<string, unknown> };
		};
		const event = config.before_send?.({
			properties: {
				$current_url: "http://127.0.0.1:3002/diagnostic?website=https%3A%2F%2Facme.example",
				$referrer: "https://search.example/?q=private",
				$lib: "web",
			},
		});

		expect(event?.properties).toEqual({
			$current_url: "http://127.0.0.1:3002/diagnostic",
			$referrer: "https://search.example/",
			$lib: "web",
		});
		vi.unstubAllGlobals();
	});

	it("removes lead-shaped values from custom event properties", async () => {
		vi.stubGlobal("window", {});
		const { initPostHog, trackEvent } = await import("./posthog");
		initPostHog({ key: "phc_test", host: "http://127.0.0.1:3002/test-posthog" });
		trackEvent("diagnostic_request", {
			stage: "contact",
			email: "ava@acme.example",
			question: "Which platform should a global team choose?",
			domain: "acme.example",
		});

		expect(posthog.capture).toHaveBeenCalledWith("diagnostic_request", { stage: "contact" });
		vi.unstubAllGlobals();
	});
});
