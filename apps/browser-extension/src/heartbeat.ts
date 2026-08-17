import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionReadiness,
	type DeviceHeartbeatInput,
	EXTENSION_VERSION,
} from "./contracts";
import { defaultSurfaceReadiness, normalizeSurfaceReadiness } from "./surface-readiness";

export function buildHeartbeat(
	userAgent: string,
	readiness: BrowserExtensionReadiness = defaultSurfaceReadiness(),
): DeviceHeartbeatInput {
	return {
		extensionVersion: EXTENSION_VERSION,
		browserFamily: "chrome",
		browserVersion: chromeVersion(userAgent),
		platform: extensionPlatform(userAgent),
		supportedSurfaces: [...BROWSER_EXTENSION_SURFACES],
		readiness: normalizeSurfaceReadiness(readiness),
	};
}

function chromeVersion(userAgent: string): string {
	const version = userAgent.match(/(?:Chrome|Chromium)\/([0-9.]+)/)?.[1];
	if (!version) throw new Error("Yonaris Browser Runner requires Chrome");
	return version;
}

function extensionPlatform(userAgent: string): "windows" | "macos" {
	if (userAgent.includes("Windows NT")) return "windows";
	if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS X")) return "macos";
	throw new Error("Yonaris Browser Runner supports Windows and macOS only");
}
