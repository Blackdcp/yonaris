import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	claimRunnerTask: vi.fn(),
	getRunnerQueueState: vi.fn(),
	resumeRunnerTask: vi.fn(),
	completeRunnerTask: vi.fn(),
	authenticateBrowserRunnerDevice: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
}));

vi.mock("@/server/browser-runner-service", () => ({
	browserRunnerClaimSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
	browserRunnerResumeSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
	browserRunnerObservationSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
	claimRunnerTask: mocks.claimRunnerTask,
	getRunnerQueueState: mocks.getRunnerQueueState,
	resumeRunnerTask: mocks.resumeRunnerTask,
	completeRunnerTask: mocks.completeRunnerTask,
}));

vi.mock("@workspace/lib/db/browser-runner-devices", () => ({
	authenticateBrowserRunnerDevice: mocks.authenticateBrowserRunnerDevice,
}));

import { Route as CompleteRoute } from "./$taskId/complete";
import { Route as ResumeRoute } from "./$taskId/resume";
import { Route as ClaimRoute } from "./claim";

type PostHandler = (input: { request: Request; params: { taskId: string } }) => Promise<Response>;
type MockRoute = { server: { handlers: { POST: PostHandler } } };

const token = "runner-token-that-is-at-least-32-characters";

describe("Browser Runner internal HTTP task contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "true");
		vi.stubEnv("BROWSER_RUNNER_API_TOKEN", token);
		vi.stubEnv("BROWSER_RUNNER_ID", "cn-runner-1");
		vi.stubEnv("BROWSER_RUNNER_MARKET", "CN");
		vi.stubEnv("BROWSER_RUNNER_LOCALE", "zh-CN");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "Asia/Shanghai");
		vi.stubEnv("ADMIN_API_KEYS", "");
	});

	afterEach(() => vi.unstubAllEnvs());

	it.each(["waiting", "drained", "settled"] as const)(
		"returns queueState=%s when the internal claim is null",
		async (queueState) => {
			mocks.claimRunnerTask.mockResolvedValue(null);
			mocks.getRunnerQueueState.mockResolvedValue(queueState);

			const response = await post(ClaimRoute, "/tasks/claim", { brandId: "stepfun", batchId: "batch-1" });

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ claim: null, queueState });
			expect(mocks.getRunnerQueueState).toHaveBeenCalledWith(
				{ brandId: "stepfun", batchId: "batch-1" },
				expect.objectContaining({ kind: "legacy_host", id: "cn-runner-1" }),
			);
		},
	);

	it("returns a claimed runnerSessionId without asking the queue-state service", async () => {
		mocks.claimRunnerTask.mockResolvedValue({
			task: { id: "task-1" },
			runnerSessionId: "durable-session-1",
			postSubmitAssist: false,
		});

		const response = await post(ClaimRoute, "/tasks/claim", { brandId: "stepfun" });

		expect(await response.json()).toMatchObject({
			claim: { runnerSessionId: "durable-session-1", postSubmitAssist: false },
		});
		expect(mocks.getRunnerQueueState).not.toHaveBeenCalled();
	});

	it("returns drained for an unscoped idle poll instead of an endless waiting loop", async () => {
		mocks.claimRunnerTask.mockResolvedValue(null);
		mocks.getRunnerQueueState.mockResolvedValue("drained");
		const response = await post(ClaimRoute, "/tasks/claim", { brandId: "stepfun" });
		expect(await response.json()).toEqual({ claim: null, queueState: "drained" });
		expect(mocks.getRunnerQueueState).toHaveBeenCalledWith(
			{ brandId: "stepfun" },
			expect.objectContaining({ kind: "legacy_host", id: "cn-runner-1" }),
		);
	});

	it("fails with 503 before invoking any service when the runner is disabled", async () => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "false");

		const response = await post(ClaimRoute, "/tasks/claim", { brandId: "stepfun" });

		expect(response.status).toBe(503);
		expect(mocks.claimRunnerTask).not.toHaveBeenCalled();
		expect(mocks.getRunnerQueueState).not.toHaveBeenCalled();
	});

	it("rejects a revoked paired device before invoking the task service", async () => {
		mocks.authenticateBrowserRunnerDevice.mockResolvedValue(null);

		const response = await post(
			ClaimRoute,
			"/tasks/claim",
			{ brandId: "stepfun", runnerId: "spoofed" },
			"ignored",
			`yrd_${"a".repeat(43)}`,
		);

		expect(response.status).toBe(401);
		expect(mocks.claimRunnerTask).not.toHaveBeenCalled();
		expect(mocks.getRunnerQueueState).not.toHaveBeenCalled();
	});

	it("preserves the durable session contract across resume and complete", async () => {
		mocks.resumeRunnerTask.mockResolvedValue({
			claim: { task: { id: "task-1" }, runnerSessionId: "durable-session-1", postSubmitAssist: true },
		});
		const resumed = await post(ResumeRoute, "/tasks/task-1/resume", { brandId: "stepfun" }, "task-1");
		expect(await resumed.json()).toMatchObject({
			claim: { runnerSessionId: "durable-session-1", postSubmitAssist: true },
		});
		expect(mocks.resumeRunnerTask).toHaveBeenCalledWith(
			"task-1",
			{ brandId: "stepfun" },
			expect.objectContaining({ id: "cn-runner-1" }),
		);

		mocks.completeRunnerTask.mockResolvedValue({ promptRunId: "run-1" });
		const completion = { brandId: "stepfun", runnerSessionId: "durable-session-1", observation: {} };
		const completed = await post(CompleteRoute, "/tasks/task-1/complete", completion, "task-1");
		expect(await completed.json()).toEqual({ promptRunId: "run-1" });
		expect(mocks.completeRunnerTask).toHaveBeenCalledWith(
			"task-1",
			completion,
			expect.objectContaining({ kind: "legacy_host", id: "cn-runner-1" }),
		);
	});
});

async function post(
	route: unknown,
	pathname: string,
	body: unknown,
	taskId = "ignored",
	bearer = token,
): Promise<Response> {
	const handler = (route as MockRoute).server.handlers.POST;
	return handler({
		request: new Request(`https://portal.example.test${pathname}`, {
			method: "POST",
			headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		params: { taskId },
	});
}
