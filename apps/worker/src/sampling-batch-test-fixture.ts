import { SAMPLING_BATCH_CAPTURE_ROUTE, SAMPLING_BATCH_SURFACE_TARGET } from "./sampling-batch-request";

export const validSamplingBatchManifest = {
	schemaVersion: 1,
	requestId: "stepfun-cn-doubao-6x-20260813",
	batch: {
		idempotencyKey: "sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-13",
		name: "StepFun CN Doubao sampling 2026-08-13 - 6x",
	},
	brand: { nameExact: "StepFun" },
	scope: {
		keyExact: "cn-zh-scored",
		marketExact: "CN",
		localeExact: "zh-CN",
		timezoneExact: "Asia/Shanghai",
		evaluationRoleExact: "scored",
	},
	promptSelection: {
		enabledCountExact: 3,
		textsExact: [
			"国内有哪些主流大模型公司?",
			"如果我要选择国产大模型服务商,有哪些推荐?",
			"阶跃星辰 StepFun 是一家什么公司?",
		],
	},
	execution: {
		mode: "browser_runner",
		surfaceTargetKey: SAMPLING_BATCH_SURFACE_TARGET,
		captureRouteKey: SAMPLING_BATCH_CAPTURE_ROUTE,
		samplesPerPrompt: 6,
		sessionRequirement: "dedicated_sampling_profile",
		searchRequirement: "platform_default",
	},
	measurementWindow: {
		startsAt: "2026-08-13T00:00:00+08:00",
		endsAt: "2026-08-20T23:59:59+08:00",
		timezone: "Asia/Shanghai",
	},
} as const;
