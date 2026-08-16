import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionReadiness,
	type BrowserExtensionReadinessStatus,
	type BrowserExtensionSurface,
	isBrowserExtensionSurface,
} from "../browser-extension-contract";
import { db } from "./db";
import {
	type BrowserRunnerDevice,
	browserRunnerDeviceBrands,
	browserRunnerDevices,
	browserRunnerPairings,
} from "./schema";

const PAIRING_LIFETIME_MS = 15 * 60 * 1000;
const DEVICE_TOKEN_PATTERN = /^yrd_[A-Za-z0-9_-]{43}$/;
const READINESS_STATUSES = [
	"ready",
	"signed_out",
	"paused_by_risk_control",
	"adapter_incompatible",
	"unavailable",
] as const satisfies readonly BrowserExtensionReadinessStatus[];

export interface BrowserRunnerDeviceHeartbeat {
	extensionVersion: string;
	browserFamily: string;
	browserVersion: string;
	platform: string;
	supportedSurfaces: readonly string[];
	readiness: Record<string, unknown>;
}

export interface ValidatedBrowserRunnerDeviceHeartbeat {
	extensionVersion: string;
	browserFamily: "chrome";
	browserVersion: string;
	platform: "windows" | "macos";
	supportedSurfaces: BrowserExtensionSurface[];
	readiness: BrowserExtensionReadiness;
}

export interface AuthenticatedBrowserRunnerDevice extends BrowserRunnerDevice {
	allowedBrandIds: string[];
}

export class BrowserRunnerDeviceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrowserRunnerDeviceError";
	}
}

export function resolvePairingConsumption(
	pairing: { expiresAt: Date; consumedAt: Date | null },
	now: Date,
): "consume" | "reject" {
	return pairing.consumedAt === null && now < pairing.expiresAt ? "consume" : "reject";
}

export function validateDeviceHeartbeat(input: BrowserRunnerDeviceHeartbeat): ValidatedBrowserRunnerDeviceHeartbeat {
	const extensionVersion = boundedIdentifier(input.extensionVersion, "extensionVersion", 50);
	if (input.browserFamily !== "chrome") throw new BrowserRunnerDeviceError("Browser Runner devices must use Chrome");
	const browserVersion = boundedIdentifier(input.browserVersion, "browserVersion", 100);
	if (input.platform !== "windows" && input.platform !== "macos") {
		throw new BrowserRunnerDeviceError("Browser Runner devices must use Windows or macOS");
	}
	if (input.supportedSurfaces.length < 1 || input.supportedSurfaces.length > BROWSER_EXTENSION_SURFACES.length) {
		throw new BrowserRunnerDeviceError("Browser Runner devices must declare one or two supported surfaces");
	}
	const supportedSurfaces: BrowserExtensionSurface[] = [];
	for (const surface of input.supportedSurfaces) {
		if (!isBrowserExtensionSurface(surface)) {
			throw new BrowserRunnerDeviceError(`Unsupported surface ${surface}`);
		}
		if (supportedSurfaces.includes(surface)) {
			throw new BrowserRunnerDeviceError(`Supported surface ${surface} was declared more than once`);
		}
		supportedSurfaces.push(surface);
	}
	if (!isPlainRecord(input.readiness)) throw new BrowserRunnerDeviceError("Device readiness must be an object");
	const readiness: BrowserExtensionReadiness = {};
	for (const [surface, rawReadiness] of Object.entries(input.readiness)) {
		if (!isBrowserExtensionSurface(surface))
			throw new BrowserRunnerDeviceError(`Unsupported readiness surface ${surface}`);
		if (!supportedSurfaces.includes(surface)) {
			throw new BrowserRunnerDeviceError(`Readiness surface ${surface} was not declared by this device`);
		}
		if (!isPlainRecord(rawReadiness)) throw new BrowserRunnerDeviceError(`Readiness for ${surface} must be an object`);
		const status = rawReadiness.status;
		if (typeof status !== "string" || !(READINESS_STATUSES as readonly string[]).includes(status)) {
			throw new BrowserRunnerDeviceError(`Readiness for ${surface} has an unsupported status`);
		}
		const activeConcurrency = rawReadiness.activeConcurrency;
		if (
			!Number.isInteger(activeConcurrency) ||
			(activeConcurrency as number) < 0 ||
			(activeConcurrency as number) > 10
		) {
			throw new BrowserRunnerDeviceError(`Readiness concurrency for ${surface} must be between 0 and 10`);
		}
		readiness[surface] = {
			status: status as BrowserExtensionReadinessStatus,
			adapterVersion: boundedIdentifier(rawReadiness.adapterVersion, `readiness.${surface}.adapterVersion`, 100),
			activeConcurrency: activeConcurrency as number,
		};
	}
	return {
		extensionVersion,
		browserFamily: "chrome",
		browserVersion,
		platform: input.platform,
		supportedSurfaces,
		readiness,
	};
}

export async function createBrowserRunnerPairing(input: {
	displayName: string;
	brandId: string;
	createdBy: string;
	now?: Date;
}): Promise<{ pairingId: string; code: string; expiresAt: Date }> {
	const now = input.now ?? new Date();
	const displayName = boundedText(input.displayName, "displayName", 100);
	const brandId = boundedText(input.brandId, "brandId", 200);
	const createdBy = boundedText(input.createdBy, "createdBy", 200);
	const code = `yrp_${randomBytes(24).toString("base64url")}`;
	const expiresAt = new Date(now.getTime() + PAIRING_LIFETIME_MS);
	const [pairing] = await db
		.insert(browserRunnerPairings)
		.values({ codeHash: sha256(code), displayName, brandId, createdBy, createdAt: now, expiresAt })
		.returning({ id: browserRunnerPairings.id });
	if (!pairing) throw new BrowserRunnerDeviceError("Failed to create Browser Runner pairing");
	return { pairingId: pairing.id, code, expiresAt };
}

export async function consumeBrowserRunnerPairing(input: {
	code: string;
	heartbeat: BrowserRunnerDeviceHeartbeat;
	now?: Date;
}): Promise<{ device: BrowserRunnerDevice; token: string }> {
	const code = boundedText(input.code, "code", 200);
	const heartbeat = validateDeviceHeartbeat(input.heartbeat);
	const now = input.now ?? new Date();
	return db.transaction(async (tx) => {
		const [pairing] = await tx
			.select()
			.from(browserRunnerPairings)
			.where(eq(browserRunnerPairings.codeHash, sha256(code)))
			.limit(1)
			.for("update");
		if (!pairing || resolvePairingConsumption(pairing, now) !== "consume") {
			throw new BrowserRunnerDeviceError("Pairing code is invalid, expired, or already consumed");
		}
		const token = `yrd_${randomBytes(32).toString("base64url")}`;
		const [device] = await tx
			.insert(browserRunnerDevices)
			.values({
				displayName: pairing.displayName,
				tokenHash: sha256(token),
				...heartbeat,
				lastSeenAt: now,
				createdBy: pairing.createdBy,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		if (!device) throw new BrowserRunnerDeviceError("Failed to create Browser Runner device");
		await tx.insert(browserRunnerDeviceBrands).values({
			deviceId: device.id,
			brandId: pairing.brandId,
			assignedBy: pairing.createdBy,
			createdAt: now,
		});
		const [consumed] = await tx
			.update(browserRunnerPairings)
			.set({ consumedAt: now, deviceId: device.id })
			.where(and(eq(browserRunnerPairings.id, pairing.id), isNull(browserRunnerPairings.consumedAt)))
			.returning({ id: browserRunnerPairings.id });
		if (!consumed) throw new BrowserRunnerDeviceError("Pairing code was consumed concurrently");
		return { device, token };
	});
}

export async function authenticateBrowserRunnerDevice(token: string): Promise<AuthenticatedBrowserRunnerDevice | null> {
	if (!DEVICE_TOKEN_PATTERN.test(token)) return null;
	const [device] = await db
		.select()
		.from(browserRunnerDevices)
		.where(and(eq(browserRunnerDevices.tokenHash, sha256(token)), isNull(browserRunnerDevices.revokedAt)))
		.limit(1);
	if (!device) return null;
	const assignments = await db
		.select({ brandId: browserRunnerDeviceBrands.brandId })
		.from(browserRunnerDeviceBrands)
		.where(eq(browserRunnerDeviceBrands.deviceId, device.id))
		.orderBy(asc(browserRunnerDeviceBrands.brandId));
	return { ...device, allowedBrandIds: assignments.map(({ brandId }) => brandId) };
}

export async function heartbeatBrowserRunnerDevice(input: {
	deviceId: string;
	heartbeat: BrowserRunnerDeviceHeartbeat;
	now?: Date;
}): Promise<BrowserRunnerDevice> {
	const heartbeat = validateDeviceHeartbeat(input.heartbeat);
	const now = input.now ?? new Date();
	const [device] = await db
		.update(browserRunnerDevices)
		.set({ ...heartbeat, lastSeenAt: now, updatedAt: now })
		.where(and(eq(browserRunnerDevices.id, input.deviceId), isNull(browserRunnerDevices.revokedAt)))
		.returning();
	if (!device) throw new BrowserRunnerDeviceError("Browser Runner device is missing or revoked");
	return device;
}

export async function listBrowserRunnerDevices(): Promise<AuthenticatedBrowserRunnerDevice[]> {
	const devices = await db.select().from(browserRunnerDevices).orderBy(asc(browserRunnerDevices.createdAt));
	const assignments = await db.select().from(browserRunnerDeviceBrands);
	return devices.map((device) => ({
		...device,
		allowedBrandIds: assignments
			.filter((assignment) => assignment.deviceId === device.id)
			.map((assignment) => assignment.brandId)
			.sort(),
	}));
}

export async function revokeBrowserRunnerDevice(input: { deviceId: string; now?: Date }): Promise<void> {
	const now = input.now ?? new Date();
	const [device] = await db
		.update(browserRunnerDevices)
		.set({ revokedAt: now, updatedAt: now })
		.where(and(eq(browserRunnerDevices.id, input.deviceId), isNull(browserRunnerDevices.revokedAt)))
		.returning({ id: browserRunnerDevices.id });
	if (!device) throw new BrowserRunnerDeviceError("Browser Runner device is missing or already revoked");
}

function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

function boundedText(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string") throw new BrowserRunnerDeviceError(`${field} is required`);
	const normalized = value.trim();
	if (normalized.length < 1 || normalized.length > maximum) {
		throw new BrowserRunnerDeviceError(`${field} must contain between 1 and ${maximum} characters`);
	}
	return normalized;
}

function boundedIdentifier(value: unknown, field: string, maximum: number): string {
	const normalized = boundedText(value, field, maximum);
	if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(normalized)) {
		throw new BrowserRunnerDeviceError(`${field} contains unsupported characters`);
	}
	return normalized;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
