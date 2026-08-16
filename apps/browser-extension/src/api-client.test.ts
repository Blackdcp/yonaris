import { describe, expect, it } from "vitest";
import { BrowserRunnerApiClient } from "./api-client";
import type { DeviceHeartbeatInput } from "./contracts";
import { claimedTask } from "./coordinator/test-fixture";

const readyHeartbeat: DeviceHeartbeatInput = {
	extensionVersion: "0.1.0",
	browserFamily: "chrome",
	browserVersion: "140.0.0",
	platform: "windows",
	supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
	readiness: {
		"doubao.consumer_web": { status: "ready", adapterVersion: "doubao-1", activeConcurrency: 0 },
		"deepseek.consumer_web": { status: "ready", adapterVersion: "deepseek-1", activeConcurrency: 0 },
	},
};

describe("BrowserRunnerApiClient", () => {
	it("sends the device bearer only to the exact configured Portal origin", async () => {
		const calls: Request[] = [];
		const client = new BrowserRunnerApiClient({
			baseUrl: "https://portal.yonaris.com",
			token: `yrd_${"a".repeat(43)}`,
			fetch: async (request) => {
				calls.push(request);
				return Response.json({
					deviceId: "device-1",
					serverTime: "2026-08-16T00:00:00.000Z",
					featureVersion: "browser-extension.v1",
				});
			},
		});

		await client.heartbeat(readyHeartbeat);
		expect(calls[0]?.url).toBe("https://portal.yonaris.com/api/internal/browser-runner/v1/device/heartbeat");
		expect(calls[0]?.headers.get("Authorization")).toBe(`Bearer yrd_${"a".repeat(43)}`);
		expect(calls[0]?.redirect).toBe("error");
		expect(calls[0]?.cache).toBe("no-store");
	});

	it("never adds an authorization header to the one-time pairing exchange", async () => {
		const calls: Request[] = [];
		const client = new BrowserRunnerApiClient({
			baseUrl: "https://portal.yonaris.com",
			fetch: async (request) => {
				calls.push(request);
				return Response.json(
					{ deviceId: "device-1", deviceToken: `yrd_${"b".repeat(43)}`, allowedBrandIds: ["stepfun"] },
					{ status: 201 },
				);
			},
		});

		await client.pair({ code: "yrp_one_time", heartbeat: readyHeartbeat });
		expect(calls[0]?.url).toBe("https://portal.yonaris.com/api/internal/browser-runner/v1/pair");
		expect(calls[0]?.headers.has("Authorization")).toBe(false);
	});

	it("rejects non-HTTPS, credentialed, and non-Portal base URLs before making a request", () => {
		for (const baseUrl of [
			"http://portal.yonaris.com",
			"https://user:pass@portal.yonaris.com",
			"https://portal.yonaris.com.evil.test",
			"https://portal.yonaris.com/path",
		]) {
			expect(() => new BrowserRunnerApiClient({ baseUrl, fetch: async () => Response.json({}) })).toThrow(
				/Portal base URL/i,
			);
		}
	});

	it("claims and validates the exact paired extension protocol", async () => {
		const calls: Request[] = [];
		const claim = claimedTask();
		const client = authenticatedClient(calls, async () =>
			Response.json({
				claim: {
					task: {
						id: claim.taskId,
						batchId: claim.batchId,
						brandId: claim.brandId,
						scopeId: claim.scopeId,
						promptId: claim.promptId,
						promptText: claim.promptText,
						sampleIndex: claim.sampleIndex,
						surfaceTargetKey: claim.surfaceTargetKey,
						captureRouteKey: claim.captureRouteKey,
						launchUrl: claim.launchUrl,
						sessionRequirement: claim.sessionRequirement,
						searchRequirement: claim.searchRequirement,
						evaluationRole: claim.evaluationRole,
						minimumEvidenceArtifacts: claim.minimumEvidenceArtifacts,
						automationAttemptCount: claim.automationAttemptCount,
					},
					leaseToken: claim.leaseToken,
					leaseGeneration: claim.leaseGeneration,
					leaseExpiresAt: claim.leaseExpiresAt,
					postSubmitAssist: claim.postSubmitAssist,
					submitConfirmed: claim.submitConfirmed,
					runnerSessionId: claim.runnerSessionId,
				},
			}),
		);

		await expect(client.claimNext("stepfun", "deepseek.consumer_web")).resolves.toEqual(claim);
		expect(await calls[0]?.json()).toEqual({ brandId: "stepfun", surfaceTargetKeys: ["deepseek.consumer_web"] });
	});

	it("rejects a mismatched capture route before it can open a consumer page", async () => {
		const claim = claimedTask();
		const client = authenticatedClient([], async () =>
			Response.json({
				claim: {
					task: { ...claim, id: claim.taskId, captureRouteKey: "browser_extension.doubao" },
					leaseToken: claim.leaseToken,
					leaseGeneration: claim.leaseGeneration,
					leaseExpiresAt: claim.leaseExpiresAt,
				},
			}),
		);
		await expect(client.claimNext("stepfun", "deepseek.consumer_web")).rejects.toThrow(/protocol/i);
	});

	it("uploads exactly one HTML page snapshot and completes with native-auto observations", async () => {
		const calls: Request[] = [];
		const client = authenticatedClient(calls, async (request) => {
			if (request.url.endsWith("/evidence/")) return Response.json({ artifact: { id: "artifact-1" } }, { status: 201 });
			return Response.json({ duplicate: false, attemptId: "attempt-1", promptRunId: "run-1" });
		});
		const claim = claimedTask();
		const artifactId = await client.uploadSnapshot(claim, "<!doctype html><html><body>answer</body></html>");
		await client.completeTask(claim, {
			runnerSessionId: "session-1",
			adapterVersion: "adapter-v1",
			browserVersion: "Chrome/140",
			answer: {
				answerText: "answer",
				answerHtml: "<article>answer</article>",
				pageUrl: "https://chat.deepseek.com/a/chat/s/1",
				observedAt: "2026-08-17T00:00:00.000Z",
				webSearchObserved: null,
				webQueries: [],
				citations: [],
				adapterVersion: "adapter-v1",
			},
			evidenceArtifactId: artifactId,
		});

		expect(artifactId).toBe("artifact-1");
		expect(calls[0]?.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(calls[0]?.headers.get("X-Yonaris-Evidence-Kind")).toBe("page_snapshot");
		expect(await calls[1]?.json()).toMatchObject({
			runnerSessionId: "session-1",
			observation: {
				sessionMode: "dedicated_sampling_profile",
				searchMode: "native_auto",
				evidenceArtifactIds: ["artifact-1"],
			},
		});
	});
});

function authenticatedClient(calls: Request[], respond: (request: Request) => Promise<Response>) {
	return new BrowserRunnerApiClient({
		baseUrl: "https://portal.yonaris.com",
		token: `yrd_${"a".repeat(43)}`,
		fetch: async (request) => {
			calls.push(request);
			return respond(request);
		},
	});
}
