import {
	constants,
	createHash,
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	privateDecrypt,
} from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BROWSER_RUNNER_BOOTSTRAP_ALGORITHM,
	type BrowserRunnerBootstrapError,
	createBrowserRunnerBootstrapEnvelope,
} from "./browser-runner-bootstrap";

let publicKeyPem: string;
let privateKeyPem: string;
let keyFingerprint: string;

describe("Browser Runner bootstrap envelope", () => {
	beforeAll(() => {
		const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
		publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
		privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
		keyFingerprint = createHash("sha256")
			.update(createPublicKey(publicKeyPem).export({ type: "spki", format: "der" }))
			.digest("hex");
	});

	beforeEach(() => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "true");
		vi.stubEnv("BROWSER_RUNNER_API_TOKEN", "0123456789abcdef".repeat(4));
		vi.stubEnv("BROWSER_RUNNER_ID", "yonaris-cn-doubao-01");
		vi.stubEnv("BROWSER_RUNNER_MARKET", "CN");
		vi.stubEnv("BROWSER_RUNNER_LOCALE", "zh-CN");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "Asia/Shanghai");
		vi.stubEnv("ADMIN_API_KEYS", "different-admin-token");
		vi.stubEnv("BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT", "2026-08-13T05:15:00.000Z");
	});

	afterEach(() => vi.unstubAllEnvs());

	it("encrypts the dedicated credential with OAEP-SHA256 and never returns it in cleartext", () => {
		const envelope = createBrowserRunnerBootstrapEnvelope({
			now: new Date("2026-08-13T05:00:00.000Z"),
			publicKeyPem,
			expectedKeyFingerprint: keyFingerprint,
		});

		expect(envelope).toEqual({
			algorithm: BROWSER_RUNNER_BOOTSTRAP_ALGORITHM,
			ciphertext: expect.any(String),
			expiresAt: "2026-08-13T05:15:00.000Z",
			keyFingerprint,
			runnerId: "yonaris-cn-doubao-01",
		});
		expect(JSON.stringify(envelope)).not.toContain("0123456789abcdef");

		const plaintext = privateDecrypt(
			{
				key: createPrivateKey(privateKeyPem),
				oaepHash: "sha256",
				padding: constants.RSA_PKCS1_OAEP_PADDING,
			},
			Buffer.from(envelope.ciphertext, "base64"),
		);
		expect(JSON.parse(plaintext.toString("utf8"))).toEqual({
			expiresAt: "2026-08-13T05:15:00.000Z",
			runnerId: "yonaris-cn-doubao-01",
			schemaVersion: 1,
			token: "0123456789abcdef".repeat(4),
		});
	});

	it("fails closed when the configured key fingerprint does not match the pinned recipient", () => {
		expect(() =>
			createBrowserRunnerBootstrapEnvelope({
				now: new Date("2026-08-13T05:00:00.000Z"),
				publicKeyPem,
				expectedKeyFingerprint: "0".repeat(64),
			}),
		).toThrowError(expect.objectContaining<Partial<BrowserRunnerBootstrapError>>({ status: 503 }));
	});

	it("returns gone after the one-time bootstrap window expires", () => {
		expect(() =>
			createBrowserRunnerBootstrapEnvelope({
				now: new Date("2026-08-13T05:15:00.000Z"),
				publicKeyPem,
				expectedKeyFingerprint: keyFingerprint,
			}),
		).toThrowError(expect.objectContaining<Partial<BrowserRunnerBootstrapError>>({ status: 410 }));
	});

	it("refuses to bootstrap when the runner feature is not fully enabled", () => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "false");
		expect(() =>
			createBrowserRunnerBootstrapEnvelope({
				now: new Date("2026-08-13T05:00:00.000Z"),
				publicKeyPem,
				expectedKeyFingerprint: keyFingerprint,
			}),
		).toThrowError(expect.objectContaining<Partial<BrowserRunnerBootstrapError>>({ status: 503 }));
	});
});
