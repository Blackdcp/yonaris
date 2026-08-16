import type { DeviceHeartbeatInput, HeartbeatResponse, PairingResponse } from "./contracts";
import { PORTAL_ORIGIN } from "./contracts";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEVICE_TOKEN_PATTERN = /^yrd_[A-Za-z0-9_-]{43}$/;

export class BrowserRunnerApiError extends Error {
	constructor(
		message: string,
		public readonly status: number | null = null,
	) {
		super(message);
		this.name = "BrowserRunnerApiError";
	}
}

export class BrowserRunnerApiClient {
	private readonly origin: typeof PORTAL_ORIGIN;
	private readonly token?: string;
	private readonly fetchImplementation: (request: Request) => Promise<Response>;
	private readonly timeoutMs: number;

	constructor(input: {
		baseUrl: string;
		token?: string;
		fetch?: (request: Request) => Promise<Response>;
		timeoutMs?: number;
	}) {
		this.origin = validatePortalBaseUrl(input.baseUrl);
		if (input.token !== undefined && !DEVICE_TOKEN_PATTERN.test(input.token)) {
			throw new BrowserRunnerApiError("Browser Runner device token is invalid");
		}
		this.token = input.token;
		this.fetchImplementation = input.fetch ?? ((request) => fetch(request));
		this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1_000 || this.timeoutMs > 60_000) {
			throw new BrowserRunnerApiError("Browser Runner request timeout is invalid");
		}
	}

	async pair(input: { code: string; heartbeat: DeviceHeartbeatInput }): Promise<PairingResponse> {
		return this.request<PairingResponse>("/api/internal/browser-runner/v1/pair", {
			authenticated: false,
			body: { code: input.code.trim(), ...input.heartbeat },
		});
	}

	async heartbeat(input: DeviceHeartbeatInput): Promise<HeartbeatResponse> {
		return this.request<HeartbeatResponse>("/api/internal/browser-runner/v1/device/heartbeat", {
			authenticated: true,
			body: input,
		});
	}

	private async request<T>(path: string, input: { authenticated: boolean; body: unknown }): Promise<T> {
		const url = new URL(path, this.origin);
		if (url.origin !== this.origin) throw new BrowserRunnerApiError("Browser Runner request escaped the Portal origin");
		const headers = new Headers({
			Accept: "application/json",
			"Cache-Control": "no-store",
			"Content-Type": "application/json",
		});
		if (input.authenticated) {
			if (!this.token) throw new BrowserRunnerApiError("Browser Runner device is not paired");
			headers.set("Authorization", `Bearer ${this.token}`);
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetchImplementation(
				new Request(url, {
					method: "POST",
					headers,
					body: JSON.stringify(input.body),
					redirect: "error",
					cache: "no-store",
					credentials: "omit",
					signal: controller.signal,
				}),
			);
			if (!response.ok) {
				throw new BrowserRunnerApiError(`Portal request failed with status ${response.status}`, response.status);
			}
			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof BrowserRunnerApiError) throw error;
			if (controller.signal.aborted) throw new BrowserRunnerApiError("Portal request timed out");
			throw new BrowserRunnerApiError("Portal request failed");
		} finally {
			clearTimeout(timeout);
		}
	}
}

export function validatePortalBaseUrl(value: string): typeof PORTAL_ORIGIN {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new BrowserRunnerApiError("Portal base URL is invalid");
	}
	if (url.origin !== PORTAL_ORIGIN || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
		throw new BrowserRunnerApiError(`Portal base URL must be exactly ${PORTAL_ORIGIN}`);
	}
	return PORTAL_ORIGIN;
}
