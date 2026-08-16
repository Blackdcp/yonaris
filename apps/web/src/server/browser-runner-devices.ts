import { createServerFn } from "@tanstack/react-start";
import type { BrowserExtensionReadiness, BrowserExtensionSurface } from "@workspace/lib/browser-extension-contract";
import { z } from "zod";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import type { BrowserRunnerPrincipal } from "./browser-runner-auth";

export const BROWSER_EXTENSION_FEATURE_VERSION = "browser-extension.v1" as const;

const surfaceSchema = z.enum(["doubao.consumer_web", "deepseek.consumer_web"]);
const readinessStateSchema = z
	.object({
		status: z.enum(["ready", "signed_out", "paused_by_risk_control", "adapter_incompatible", "unavailable"]),
		adapterVersion: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[0-9A-Za-z][0-9A-Za-z._-]*$/),
		activeConcurrency: z.number().int().min(0).max(10),
	})
	.strict();

const readinessSchema = z
	.object({
		"doubao.consumer_web": readinessStateSchema.optional(),
		"deepseek.consumer_web": readinessStateSchema.optional(),
	})
	.strict();

export const browserRunnerDeviceHeartbeatSchema = z
	.object({
		extensionVersion: z
			.string()
			.trim()
			.min(1)
			.max(50)
			.regex(/^[0-9A-Za-z][0-9A-Za-z._-]*$/),
		browserFamily: z.literal("chrome"),
		browserVersion: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[0-9A-Za-z][0-9A-Za-z._-]*$/),
		platform: z.enum(["windows", "macos"]),
		supportedSurfaces: z.array(surfaceSchema).min(1).max(2),
		readiness: readinessSchema,
	})
	.strict();

export const browserRunnerPairSchema = browserRunnerDeviceHeartbeatSchema
	.extend({ code: z.string().trim().min(1).max(200) })
	.strict();

const createPairingSchema = z
	.object({
		brandId: z.string().trim().min(1).max(200),
		displayName: z.string().trim().min(1).max(100),
	})
	.strict();

const revokeDeviceSchema = z.object({ deviceId: z.guid() }).strict();

type HeartbeatInput = z.infer<typeof browserRunnerDeviceHeartbeatSchema>;
type PairInput = z.infer<typeof browserRunnerPairSchema>;

export async function pairBrowserRunnerDevice(
	input: PairInput,
	dependencies: {
		consumePairing?: (input: {
			code: string;
			heartbeat: HeartbeatInput;
		}) => Promise<{ device: { id: string }; token: string; allowedBrandIds: string[] }>;
	} = {},
) {
	await assertBrowserRunnerFeatureEnabled();
	const { BrowserRunnerDeviceError, consumeBrowserRunnerPairing } = await import(
		"@workspace/lib/db/browser-runner-devices"
	);
	const { BrowserRunnerHttpError } = await import("./browser-runner-auth");
	const { code, ...heartbeat } = browserRunnerPairSchema.parse(input);
	let paired: Awaited<ReturnType<NonNullable<typeof dependencies.consumePairing>>>;
	try {
		paired = await (dependencies.consumePairing ?? consumeBrowserRunnerPairing)({ code, heartbeat });
	} catch (error) {
		if (error instanceof BrowserRunnerDeviceError) {
			throw new BrowserRunnerHttpError(401, "Valid pairing code required");
		}
		throw error;
	}
	return {
		deviceId: paired.device.id,
		deviceToken: paired.token,
		allowedBrandIds: paired.allowedBrandIds,
	};
}

export async function updateBrowserRunnerDeviceHeartbeat(
	principal: BrowserRunnerPrincipal,
	input: HeartbeatInput,
	dependencies: {
		heartbeatDevice?: (input: { deviceId: string; heartbeat: HeartbeatInput }) => Promise<{ id: string }>;
		now?: () => Date;
	} = {},
) {
	await assertBrowserRunnerFeatureEnabled();
	const { heartbeatBrowserRunnerDevice } = await import("@workspace/lib/db/browser-runner-devices");
	const { BrowserRunnerHttpError } = await import("./browser-runner-auth");
	if (principal.kind !== "browser_extension") {
		throw new BrowserRunnerHttpError(403, "Paired Browser Runner device required");
	}
	const heartbeat = browserRunnerDeviceHeartbeatSchema.parse(input);
	for (const surface of heartbeat.supportedSurfaces) {
		if (!principal.supportedSurfaces.includes(surface)) {
			throw new BrowserRunnerHttpError(403, `Device is not authorized for ${surface}`);
		}
	}
	const device = await (dependencies.heartbeatDevice ?? heartbeatBrowserRunnerDevice)({
		deviceId: principal.id,
		heartbeat,
	});
	return {
		deviceId: device.id,
		serverTime: (dependencies.now ?? (() => new Date()))().toISOString(),
		featureVersion: BROWSER_EXTENSION_FEATURE_VERSION,
	};
}

export const createBrowserRunnerPairingFn = createServerFn({ method: "POST" })
	.validator(createPairingSchema)
	.handler(async ({ data }) => {
		const session = await requirePlatformAdmin();
		await assertBrowserRunnerFeatureEnabled();
		const { createBrowserRunnerPairing } = await import("@workspace/lib/db/browser-runner-devices");
		return createBrowserRunnerPairing({ ...data, createdBy: session.user.id });
	});

export const listBrowserRunnerDevicesFn = createServerFn({ method: "GET" }).handler(async () => {
	await requirePlatformAdmin();
	const { listBrowserRunnerDevices } = await import("@workspace/lib/db/browser-runner-devices");
	return (await listBrowserRunnerDevices()).map((device) => ({
		id: device.id,
		displayName: device.displayName,
		extensionVersion: device.extensionVersion,
		browserFamily: device.browserFamily,
		browserVersion: device.browserVersion,
		platform: device.platform,
		supportedSurfaces: device.supportedSurfaces as BrowserExtensionSurface[],
		readiness: device.readiness as BrowserExtensionReadiness,
		lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
		revokedAt: device.revokedAt?.toISOString() ?? null,
		allowedBrandIds: device.allowedBrandIds,
	}));
});

export const revokeBrowserRunnerDeviceFn = createServerFn({ method: "POST" })
	.validator(revokeDeviceSchema)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		const { revokeBrowserRunnerDevice } = await import("@workspace/lib/db/browser-runner-devices");
		await revokeBrowserRunnerDevice(data);
		return { revoked: true };
	});

async function assertBrowserRunnerFeatureEnabled(): Promise<void> {
	const { BrowserRunnerHttpError, browserRunnerFeatureEnabled } = await import("./browser-runner-auth");
	if (!browserRunnerFeatureEnabled()) throw new BrowserRunnerHttpError(503, "Browser Runner is disabled");
}

async function requirePlatformAdmin() {
	const session = await requireAuthSession();
	if (!isAdmin(session)) throw new Error("Forbidden: Platform administrator access required");
	return session;
}
