import { constants, createHash, createPublicKey, publicEncrypt } from "node:crypto";
import { browserRunnerEnabled } from "./browser-runner-auth";

export const BROWSER_RUNNER_BOOTSTRAP_ALGORITHM = "RSA-OAEP-3072-SHA256" as const;

const PINNED_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAxYFxWJHosCi9Qtnu5eQs
jxANN7QVuVtOXSnOy8gZp4JNy1RhV15Keydcs4mV8Z6kjCxYlkVd0VrbZI/uppRc
tzRBp7jY396MqoDR8QcDkIeOCPBNjtpdRLHn7ns7Z0E/owpi+vAn7iiGxgwVGL7Y
7a2d2OK/eFhaw2bHaqZOcwlq+pc1n4OxYdR9s9k/35B7/oLwcgEyQbdVI4Mir0M/
kQCbruxxVW/LuPoyfcxIVo5U50ZunoOgNDCIcsaqUr9XlP7uwgMxoUWx0+REnlg1
wMeH9rHKyjDsAGTdJigx3GDQrt/AQnNir3O05R8lQOHNl8OTheDebz29VpPuwY3S
UrnxqExCTLSKH1XiL4uTabQNgrXBwlcjyNXlaeEz4gtUGiA2yqD43Q4gE2pJC0yy
xN3SdZMzUyol0TS6YMGiLxOwy2BS0CCZF1iF+hTHnIOplvE0P19Fl84LKySNjzbL
8lTtd0NmCiScSaxXZdFhpMTToUzlt4JXZ+m8yYfVPiUzAgMBAAE=
-----END PUBLIC KEY-----`;
const PINNED_KEY_FINGERPRINT = "fbee6383aa7952fc55c5da059ecf59ee8e469644781a34ecf40c4a408ec5b75c";

export class BrowserRunnerBootstrapError extends Error {
	constructor(
		public readonly status: 410 | 503,
		message: string,
	) {
		super(message);
		this.name = "BrowserRunnerBootstrapError";
	}
}

export interface BrowserRunnerBootstrapEnvelope {
	algorithm: typeof BROWSER_RUNNER_BOOTSTRAP_ALGORITHM;
	ciphertext: string;
	expiresAt: string;
	keyFingerprint: string;
	runnerId: string;
}

export function createBrowserRunnerBootstrapEnvelope(
	options: { now?: Date; publicKeyPem?: string; expectedKeyFingerprint?: string } = {},
): BrowserRunnerBootstrapEnvelope {
	if (!browserRunnerEnabled()) {
		throw new BrowserRunnerBootstrapError(503, "Browser Runner is disabled or not ready");
	}
	const token = process.env.BROWSER_RUNNER_API_TOKEN?.trim();
	const runnerId = process.env.BROWSER_RUNNER_ID?.trim();
	const expiresAt = parseExpiry(process.env.BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT);
	if (!token || !runnerId || !expiresAt) {
		throw new BrowserRunnerBootstrapError(503, "Browser Runner bootstrap is not configured");
	}
	const now = options.now ?? new Date();
	if (now.getTime() >= expiresAt.getTime()) {
		throw new BrowserRunnerBootstrapError(410, "Browser Runner bootstrap window has expired");
	}
	const publicKey = createPublicKey(options.publicKeyPem ?? PINNED_PUBLIC_KEY_PEM);
	const fingerprint = createHash("sha256")
		.update(publicKey.export({ type: "spki", format: "der" }))
		.digest("hex");
	const expectedFingerprint = options.expectedKeyFingerprint ?? PINNED_KEY_FINGERPRINT;
	if (fingerprint !== expectedFingerprint) {
		throw new BrowserRunnerBootstrapError(503, "Browser Runner bootstrap recipient does not match the pinned key");
	}
	const plaintext = Buffer.from(
		JSON.stringify({ expiresAt: expiresAt.toISOString(), runnerId, schemaVersion: 1, token }),
		"utf8",
	);
	const ciphertext = publicEncrypt(
		{ key: publicKey, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING },
		plaintext,
	);
	return {
		algorithm: BROWSER_RUNNER_BOOTSTRAP_ALGORITHM,
		ciphertext: ciphertext.toString("base64"),
		expiresAt: expiresAt.toISOString(),
		keyFingerprint: fingerprint,
		runnerId,
	};
}

function parseExpiry(value: string | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? parsed : null;
}
