import { lookup } from "node:dns/promises";
import { createServer, isIP, type Server, Socket } from "node:net";

const MAXIMUM_REQUEST_HEAD_BYTES = 8_192;
const CONNECT_TIMEOUT_MS = 20_000;

export type ProxyResolver = (hostname: string) => Promise<string[]>;

export type ApprovedProxyTarget = {
	hostname: string;
	port: 443;
	address: string;
	family: 4 | 6;
};

export type EgressProxyOptions = {
	approvedHostnames: ReadonlySet<string>;
	controlPlaneHosts: ReadonlySet<string>;
	resolver?: ProxyResolver;
};

export function parseProxyHostList(content: string, allowIpLiterals: boolean): Set<string> {
	if (Buffer.byteLength(content, "utf8") > 64 * 1_024) throw new Error("Proxy hostname list is too large");
	const result = new Set<string>();
	for (const rawLine of content.split(/\r?\n/)) {
		const value = rawLine.replace(/#.*/, "").trim().toLowerCase();
		if (!value) continue;
		if (!((isIP(value) === 0 && validHostname(value)) || (allowIpLiterals && isIP(value) !== 0))) {
			throw new Error("Proxy hostname list contains a non-exact or invalid entry");
		}
		result.add(value);
	}
	if (result.size === 0) throw new Error("Proxy hostname list is empty");
	return result;
}

export function createEgressProxyServer(options: EgressProxyOptions): Server {
	return createServer((client) => handleClient(client, options));
}

export function parseProxyRequestHead(value: string): string {
	if (Buffer.byteLength(value, "utf8") > MAXIMUM_REQUEST_HEAD_BYTES || !value.endsWith("\r\n\r\n")) {
		throw new Error("Proxy request head is invalid");
	}
	const lines = value.split("\r\n");
	const match = lines[0]?.match(/^CONNECT ([^ ]+) HTTP\/1\.1$/);
	if (!match?.[1]) throw new Error("Proxy permits HTTP/1.1 CONNECT only");
	if (lines.some((line) => /^proxy-authorization\s*:/i.test(line))) {
		throw new Error("Proxy credentials are not accepted");
	}
	return match[1];
}

export function parseApprovedProxyAuthority(authority: string, approvedHostnames: ReadonlySet<string>) {
	if (!authority || authority.length > 500 || /[\s/@?#\\]/.test(authority)) {
		throw new Error("Proxy authority is invalid");
	}
	const separator = authority.lastIndexOf(":");
	if (separator < 1 || authority.slice(separator + 1) !== "443") {
		throw new Error("Proxy permits HTTPS CONNECT port 443 only");
	}
	const hostname = authority.slice(0, separator).toLowerCase();
	if (!validHostname(hostname) || isIP(hostname) !== 0 || !approvedHostnames.has(hostname)) {
		throw new Error("Proxy hostname is not explicitly approved");
	}
	return { hostname, port: 443 as const };
}

export async function resolveApprovedProxyTarget(
	authority: string,
	approvedHostnames: ReadonlySet<string>,
	controlPlaneHosts: ReadonlySet<string>,
	resolver: ProxyResolver = resolveAll,
): Promise<ApprovedProxyTarget> {
	const target = parseApprovedProxyAuthority(authority, approvedHostnames);
	const addresses = unique(await resolver(target.hostname));
	if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
		throw new Error("Approved proxy hostname did not resolve exclusively to public addresses");
	}
	const controlAddresses = new Set<string>();
	for (const entry of controlPlaneHosts) {
		if (isIP(entry)) controlAddresses.add(normalizeIp(entry));
		else {
			for (const address of await resolver(entry)) controlAddresses.add(normalizeIp(address));
		}
	}
	if (addresses.some((address) => controlAddresses.has(normalizeIp(address)))) {
		throw new Error("Approved proxy hostname resolved to a control-plane address");
	}
	const address = addresses[0];
	if (!address) throw new Error("Approved proxy hostname did not resolve");
	const family = isIP(address);
	if (family !== 4 && family !== 6) throw new Error("Proxy resolver returned an invalid address");
	return { ...target, address, family };
}

async function resolveAll(hostname: string): Promise<string[]> {
	return (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
}

function handleClient(client: Socket, options: EgressProxyOptions): void {
	client.setTimeout(CONNECT_TIMEOUT_MS);
	let pending = Buffer.alloc(0);
	const reject = () => {
		if (!client.destroyed) client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
	};
	const onData = async (chunk: Buffer) => {
		client.pause();
		pending = Buffer.concat([pending, chunk]);
		if (pending.byteLength > MAXIMUM_REQUEST_HEAD_BYTES) {
			client.removeListener("data", onData);
			reject();
			return;
		}
		const end = pending.indexOf("\r\n\r\n");
		if (end < 0) {
			client.resume();
			return;
		}
		client.removeListener("data", onData);
		try {
			const authority = parseProxyRequestHead(pending.subarray(0, end + 4).toString("utf8"));
			const target = await resolveApprovedProxyTarget(
				authority,
				options.approvedHostnames,
				options.controlPlaneHosts,
				options.resolver,
			);
			const upstream = await connectUpstream(target);
			client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
			const remainder = pending.subarray(end + 4);
			if (remainder.byteLength > 0) upstream.write(remainder);
			client.setTimeout(0);
			upstream.setTimeout(0);
			client.pipe(upstream).pipe(client);
			const closeBoth = () => {
				client.destroy();
				upstream.destroy();
			};
			client.on("error", closeBoth);
			upstream.on("error", closeBoth);
		} catch {
			reject();
		}
	};
	client.on("timeout", () => client.destroy());
	client.on("error", () => client.destroy());
	client.on("data", onData);
}

function connectUpstream(target: ApprovedProxyTarget): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = new Socket();
		const timeout = setTimeout(() => {
			socket.destroy();
			reject(new Error("Proxy upstream connection timed out"));
		}, CONNECT_TIMEOUT_MS);
		socket.once("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		socket.connect({ host: target.address, port: target.port, family: target.family }, () => {
			clearTimeout(timeout);
			socket.removeAllListeners("error");
			resolve(socket);
		});
	});
}

function unique(values: string[]): string[] {
	return [...new Set(values.map(normalizeIp))];
}

function validHostname(value: string): boolean {
	if (value.length > 253 || value.endsWith(".")) return false;
	const labels = value.split(".");
	return (
		labels.length >= 2 &&
		labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
	);
}

function normalizeIp(value: string): string {
	return value.toLowerCase();
}

export function isPublicAddress(value: string): boolean {
	const family = isIP(value);
	if (family === 4) return isPublicIpv4(value);
	if (family === 6) return isPublicIpv6(value);
	return false;
}

function isPublicIpv4(value: string): boolean {
	const octets = value.split(".").map(Number);
	if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return false;
	}
	const [a = 0, b = 0, c = 0] = octets;
	if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
	if (a === 100 && b >= 64 && b <= 127) return false;
	if (a === 169 && b === 254) return false;
	if (a === 172 && b >= 16 && b <= 31) return false;
	if (a === 192 && ((b === 0 && c === 0) || (b === 0 && c === 2) || b === 168)) return false;
	if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
	if (a === 203 && b === 0 && c === 113) return false;
	return true;
}

function isPublicIpv6(value: string): boolean {
	const first = Number.parseInt(value.split(":", 1)[0] ?? "", 16);
	if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
	return !value.toLowerCase().startsWith("2001:db8:");
}
