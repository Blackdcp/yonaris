import { describe, expect, it } from "vitest";
import { BrowserRunnerApiClient } from "./api-client";
import { BROWSER_EXTENSION_SURFACES, type DeviceHeartbeatInput } from "./contracts";
import { claimedTask } from "./coordinator/test-fixture";
import { extensionSurfaceDefinition } from "./surface-registry";

const readyHeartbeat: DeviceHeartbeatInput = {
	extensionVersion: "0.2.0",
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
		expect(await calls[0]?.json()).toEqual({
			brandId: "stepfun",
			surfaceTargetKeys: ["deepseek.consumer_web"],
			adapterVersion: "deepseek-web-20260821-localpc-v2",
		});
	});

	it("claims the exact capture route and launch URL for every registered surface", async () => {
		for (const surface of BROWSER_EXTENSION_SURFACES) {
			const definition = extensionSurfaceDefinition(surface);
			const claim = claimedTask({
				surfaceTargetKey: surface,
				captureRouteKey: definition.captureRoute,
				launchUrl: definition.launchUrl,
			});
			const client = authenticatedClient([], async () =>
				Response.json({
					claim: {
						task: { ...claim, id: claim.taskId },
						leaseToken: claim.leaseToken,
						leaseGeneration: claim.leaseGeneration,
						leaseExpiresAt: claim.leaseExpiresAt,
						postSubmitAssist: claim.postSubmitAssist,
						submitConfirmed: claim.submitConfirmed,
						runnerSessionId: claim.runnerSessionId,
					},
				}),
			);

			await expect(client.claimNext("stepfun", surface)).resolves.toEqual(claim);
		}
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

	it("requests an explicit exact-task pre-submit recovery without claiming new work", async () => {
		const calls: Request[] = [];
		const claim = claimedTask();
		const client = authenticatedClient(calls, async () =>
			Response.json({
				task: { ...claim, id: claim.taskId },
				leaseToken: claim.leaseToken,
				leaseGeneration: claim.leaseGeneration,
				leaseExpiresAt: claim.leaseExpiresAt,
				postSubmitAssist: false,
				submitConfirmed: false,
				runnerSessionId: null,
			}),
		);

		await client.resume("task-1", "stepfun", "pre_submit", "doubao.consumer_web");

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url.endsWith("/api/internal/browser-runner/v1/tasks/task-1/resume")).toBe(true);
		expect(await calls[0]?.json()).toEqual({
			brandId: "stepfun",
			stage: "pre_submit",
			adapterVersion: "doubao-web-20260819-localpc-v8",
		});
	});

	it("binds every leased Doubao mutation before completion to the running adapter version", async () => {
		const calls: Request[] = [];
		const client = authenticatedClient(calls, async () => Response.json({}));
		const claim = claimedTask({ surfaceTargetKey: "doubao.consumer_web" });

		await client.heartbeatTask(claim);
		await client.recordSubmitIntent(claim, "runner-session-1");
		await client.confirmSubmitted(claim, "runner-session-1");

		expect(await Promise.all(calls.map((call) => call.json()))).toEqual([
			{
				brandId: "stepfun",
				leaseToken: claim.leaseToken,
				leaseGeneration: claim.leaseGeneration,
				adapterVersion: "doubao-web-20260819-localpc-v8",
			},
			{
				brandId: "stepfun",
				leaseToken: claim.leaseToken,
				leaseGeneration: claim.leaseGeneration,
				runnerSessionId: "runner-session-1",
				adapterVersion: "doubao-web-20260819-localpc-v8",
			},
			{
				brandId: "stepfun",
				leaseToken: claim.leaseToken,
				leaseGeneration: claim.leaseGeneration,
				runnerSessionId: "runner-session-1",
				adapterVersion: "doubao-web-20260819-localpc-v8",
			},
		]);
	});

	it("reconciles the exact local task before the coordinator can claim new work", async () => {
		const calls: Request[] = [];
		const client = authenticatedClient(calls, async () =>
			Response.json({
				state: "resumable_pre",
				task: {
					taskId: "task-1",
					batchId: "batch-1",
					brandId: "stepfun",
					surfaceTargetKey: "deepseek.consumer_web",
					promptText: "Prompt A",
				},
				runnerSessionId: null,
			}),
		);

		await expect(client.reconcileTask("task-1", "stepfun")).resolves.toEqual({
			state: "resumable_pre",
			task: {
				taskId: "task-1",
				batchId: "batch-1",
				brandId: "stepfun",
				surfaceTargetKey: "deepseek.consumer_web",
				promptText: "Prompt A",
			},
			runnerSessionId: null,
		});
		expect(calls[0]?.url.endsWith("/api/internal/browser-runner/v1/tasks/task-1/reconcile")).toBe(true);
		expect(await calls[0]?.json()).toEqual({ brandId: "stepfun" });
	});

	it("rejects an unsafe exact-task reconciliation response", async () => {
		const client = authenticatedClient([], async () =>
			Response.json({
				state: "terminal",
				task: {
					taskId: "different-task",
					batchId: "batch-1",
					brandId: "stepfun",
					surfaceTargetKey: "deepseek.consumer_web",
					promptText: "Prompt A",
				},
				runnerSessionId: null,
			}),
		);

		await expect(client.reconcileTask("task-1", "stepfun")).rejects.toThrow(/protocol/i);
	});

	it("uploads exactly one JPEG screenshot and completes with a strict structured observation", async () => {
		const calls: Request[] = [];
		const client = authenticatedClient(calls, async (request) => {
			if (request.url.endsWith("/evidence/")) return Response.json({ artifact: { id: "artifact-1" } }, { status: 201 });
			return Response.json({ duplicate: false, attemptId: "attempt-1", promptRunId: "run-1" });
		});
		const claim = claimedTask();
		const screenshot = Uint8Array.from([0xff, 0xd8, 0xff, 0x01, 0x02]);
		const artifactId = await client.uploadEvidence(claim, "session-1", "adapter-v1", screenshot);
		await client.completeTask(claim, {
			runnerSessionId: "session-1",
			adapterVersion: "adapter-v1",
			browserVersion: "Chrome/140",
			answer: {
				answerText: "answer",
				evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
				pageUrl: "https://chat.deepseek.com/a/chat/s/1",
				observedAt: "2026-08-17T00:00:00.000Z",
				webSearchObserved: true,
				webQueries: ["国产 GPU API", "AI inference pricing"],
				citations: [{ url: "https://source.example/report", title: "Source report" }],
				adapterVersion: "adapter-v1",
			},
			evidenceArtifactId: artifactId,
		});

		expect(artifactId).toBe("artifact-1");
		expect(calls[0]?.headers.get("Content-Type")).toBe("image/jpeg");
		expect(calls[0]?.headers.get("X-Yonaris-Evidence-Kind")).toBe("screenshot");
		expect(calls[0]?.headers.get("X-Yonaris-Runner-Session-Id")).toBe("session-1");
		expect(calls[0]?.headers.get("X-Yonaris-Adapter-Version")).toBe("adapter-v1");
		expect(new Uint8Array(await calls[0]?.arrayBuffer())).toEqual(screenshot);
		const completion = await calls[1]?.json();
		expect(completion).toMatchObject({
			runnerSessionId: "session-1",
			observation: {
				schemaVersion: "browser-runner-observation.v2",
				sessionMode: "dedicated_sampling_profile",
				searchMode: "native_auto",
				webSearchObserved: true,
				webQueries: ["国产 GPU API", "AI inference pricing"],
				citations: [{ url: "https://source.example/report", title: "Source report" }],
				evidenceArtifactIds: ["artifact-1"],
				captureDiagnostics: { answerCount: 1, queryCount: 2, citationCount: 1, completionCount: 1 },
			},
		});
		expect(JSON.stringify(completion)).not.toContain("answerHtml");
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
