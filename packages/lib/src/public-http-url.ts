import { lookup as lookupCallback } from "node:dns";
import { lookup as lookupPromise } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"metadata",
	"metadata.google.internal",
	"instance-data",
	"instance-data.ec2.internal",
]);
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan"];
const FORBIDDEN_REQUEST_HEADERS = new Set(["connection", "host", "proxy-authorization"]);
const CROSS_ORIGIN_CREDENTIAL_HEADERS = new Set(["authorization", "cookie"]);

export type ResolvedAddress = { address: string; family: number };
export type PublicUrlResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface SafeFetchDependencies {
	resolveHostname?: PublicUrlResolver;
	fetch?: (input: string, init: SafeFetchInit) => Promise<SafeHttpResponse>;
}

export interface SafeFetchInit {
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export interface SafeHttpResponse {
	ok: boolean;
	status: number;
	headers: { get(name: string): string | null };
	body?: { cancel(): Promise<void> } | null;
	text(): Promise<string>;
}

export class UnsafeUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnsafeUrlError";
	}
}

function ipv4ToNumber(address: string): number | null {
	const parts = address.split(".");
	if (parts.length !== 4) return null;
	let value = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const octet = Number(part);
		if (octet > 255) return null;
		value = value * 256 + octet;
	}
	return value >>> 0;
}

function inIpv4Cidr(value: number, base: string, prefixLength: number): boolean {
	const baseValue = ipv4ToNumber(base);
	if (baseValue === null) return false;
	const hostBits = 32 - prefixLength;
	const divisor = 2 ** hostBits;
	return Math.floor(value / divisor) === Math.floor(baseValue / divisor);
}

function ipv6ToBytes(address: string): number[] | null {
	const withoutZone = address.split("%")[0]?.toLowerCase();
	if (!withoutZone) return null;
	let value = withoutZone;
	const embeddedIpv4 = value.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
	if (embeddedIpv4) {
		const ipv4 = ipv4ToNumber(embeddedIpv4);
		if (ipv4 === null) return null;
		value = `${value.slice(0, -embeddedIpv4.length)}${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
	}

	const halves = value.split("::");
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(":") : [];
	const right = halves[1] ? halves[1].split(":") : [];
	const missing = 8 - left.length - right.length;
	if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
	const groups = [...left, ...Array.from({ length: Math.max(0, missing) }, () => "0"), ...right];
	if (groups.length !== 8) return null;

	const result: number[] = [];
	for (const group of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
		const numeric = Number.parseInt(group, 16);
		result.push(numeric >>> 8, numeric & 0xff);
	}
	return result;
}

function inIpv6Cidr(value: number[], base: string, prefixLength: number): boolean {
	const baseValue = ipv6ToBytes(base);
	if (baseValue === null) return false;
	const completeBytes = Math.floor(prefixLength / 8);
	for (let index = 0; index < completeBytes; index += 1) {
		if (value[index] !== baseValue[index]) return false;
	}
	const remainingBits = prefixLength % 8;
	if (remainingBits === 0) return true;
	const mask = (0xff << (8 - remainingBits)) & 0xff;
	return ((value[completeBytes] ?? 0) & mask) === ((baseValue[completeBytes] ?? 0) & mask);
}

/** Return true only for ordinary globally routable unicast addresses. */
export function isPublicIpAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) {
		const value = ipv4ToNumber(address);
		if (value === null) return false;
		const blocked: Array<[string, number]> = [
			["0.0.0.0", 8],
			["10.0.0.0", 8],
			["100.64.0.0", 10],
			["127.0.0.0", 8],
			["169.254.0.0", 16],
			["172.16.0.0", 12],
			["192.0.0.0", 24],
			["192.0.2.0", 24],
			["192.168.0.0", 16],
			["198.18.0.0", 15],
			["198.51.100.0", 24],
			["203.0.113.0", 24],
			["224.0.0.0", 4],
			["240.0.0.0", 4],
		];
		return !blocked.some(([base, prefix]) => inIpv4Cidr(value, base, prefix));
	}
	if (family !== 6) return false;

	const value = ipv6ToBytes(address);
	if (value === null || !inIpv6Cidr(value, "2000::", 3)) return false;
	const blocked: Array<[string, number]> = [
		["2001::", 32],
		["2001:2::", 48],
		["2001:10::", 28],
		["2001:20::", 28],
		["2001:db8::", 32],
		["2002::", 16],
	];
	return !blocked.some(([base, prefix]) => inIpv6Cidr(value, base, prefix));
}

export const resolvePublicHostname: PublicUrlResolver = async (hostname) => {
	return lookupPromise(hostname, { all: true, verbatim: true });
};

/** Parse a URL and prove that every current DNS answer is public. */
export async function validatePublicHttpUrl(
	input: string,
	resolveHostname: PublicUrlResolver = resolvePublicHostname,
): Promise<URL> {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new UnsafeUrlError("URL is invalid");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new UnsafeUrlError("URL must use HTTP or HTTPS");
	}
	if (url.username || url.password) {
		throw new UnsafeUrlError("URL credentials are not allowed");
	}

	const hostname = url.hostname
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "")
		.toLowerCase();
	if (
		!hostname ||
		BLOCKED_HOSTNAMES.has(hostname) ||
		BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
	) {
		throw new UnsafeUrlError("URL hostname is not public");
	}
	// IP literals are rejected even when globally routable so every request goes
	// through the same DNS validation and connection-time pinning path.
	if (isIP(hostname) !== 0) {
		throw new UnsafeUrlError("IP-address URLs are not allowed");
	}

	let answers: ResolvedAddress[];
	try {
		answers = await resolveHostname(hostname);
	} catch {
		throw new UnsafeUrlError("URL hostname could not be resolved");
	}
	if (answers.length === 0 || answers.some(({ address }) => !isPublicIpAddress(address))) {
		throw new UnsafeUrlError("URL hostname does not resolve exclusively to public addresses");
	}
	return url;
}

type SecureLookupOptions = { family?: number; hints?: number; all?: boolean };
type SecureLookupCallback = (
	error: NodeJS.ErrnoException | Error | null,
	address: string | ResolvedAddress[],
	family?: number,
) => void;

const secureLookup = ((hostname: string, options: number | SecureLookupOptions, callback: SecureLookupCallback) => {
	const normalizedOptions = typeof options === "number" ? { family: options } : (options ?? {});
	lookupCallback(
		hostname,
		{ family: normalizedOptions.family, hints: normalizedOptions.hints, all: true, verbatim: true },
		(error, addresses) => {
			if (error) {
				callback(error, "", 0);
				return;
			}
			if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
				callback(new UnsafeUrlError("Connection-time DNS answer is not public"), "", 0);
				return;
			}
			if (normalizedOptions.all) {
				(callback as (error: Error | null, addresses: ResolvedAddress[]) => void)(null, addresses);
				return;
			}
			const first = addresses[0];
			if (!first) {
				callback(new UnsafeUrlError("URL hostname did not resolve"), "", 0);
				return;
			}
			callback(null, first.address, first.family);
		},
	);
}) as LookupFunction;

function pinnedPublicFetch(input: string, init: SafeFetchInit): Promise<SafeHttpResponse> {
	return new Promise((resolve, reject) => {
		const url = new URL(input);
		const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
			url,
			{
				method: "GET",
				headers: init.headers,
				lookup: secureLookup,
				signal: init.signal,
			},
			(response) => {
				let settled = false;
				const chunks: Buffer[] = [];
				let totalBytes = 0;
				const body = new Promise<string>((resolveBody, rejectBody) => {
					response.on("data", (chunk: Buffer) => {
						totalBytes += chunk.length;
						if (totalBytes > MAX_RESPONSE_BYTES) {
							response.destroy(new Error("Response body exceeded the safe size limit"));
							return;
						}
						chunks.push(chunk);
					});
					response.once("end", () => {
						settled = true;
						resolveBody(Buffer.concat(chunks).toString("utf8"));
					});
					response.once("error", (error) => {
						settled = true;
						rejectBody(error);
					});
				});
				// Redirect responses are intentionally discarded without reading text.
				// Keep a rejection handler attached if the socket fails while discarded.
				void body.catch(() => undefined);
				resolve({
					ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
					status: response.statusCode ?? 0,
					headers: {
						get(name) {
							const value = response.headers[name.toLowerCase()];
							return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
						},
					},
					body: {
						async cancel() {
							if (!settled) response.destroy();
						},
					},
					text: () => body,
				});
			},
		);
		request.once("error", reject);
		request.end();
	});
}

/** Fetch with DNS pinning, manual redirect validation, and a bounded redirect chain. */
export async function safeFetchPublicHttpUrl(
	input: string,
	init: SafeFetchInit = {},
	dependencies: SafeFetchDependencies = {},
): Promise<SafeHttpResponse> {
	const resolveHostname = dependencies.resolveHostname ?? resolvePublicHostname;
	const fetchImpl = dependencies.fetch ?? pinnedPublicFetch;
	let current = await validatePublicHttpUrl(input, resolveHostname);
	let headers = Object.fromEntries(
		Object.entries(init.headers ?? {}).filter(([name]) => !FORBIDDEN_REQUEST_HEADERS.has(name.toLowerCase())),
	);

	for (let redirects = 0; ; redirects += 1) {
		const response = await fetchImpl(current.href, { ...init, headers });
		if (!REDIRECT_STATUSES.has(response.status)) return response;

		const location = response.headers.get("location");
		if (!location) return response;
		if (redirects >= MAX_REDIRECTS) {
			await response.body?.cancel();
			throw new UnsafeUrlError("URL redirected too many times");
		}
		const next = new URL(location, current);
		await response.body?.cancel();
		const validatedNext = await validatePublicHttpUrl(next.href, resolveHostname);
		if (validatedNext.origin !== current.origin) {
			headers = Object.fromEntries(
				Object.entries(headers).filter(([name]) => !CROSS_ORIGIN_CREDENTIAL_HEADERS.has(name.toLowerCase())),
			);
		}
		current = validatedNext;
	}
}
