import { lstat, readFile } from "node:fs/promises";
import { createEgressProxyServer, parseProxyHostList } from "./egress-proxy.js";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 17_777;

async function main(): Promise<void> {
	if (process.platform !== "linux" || process.getuid?.() === undefined) {
		throw new Error("Browser egress proxy requires a Linux service UID");
	}
	const expectedUid = positiveInteger(process.env.BROWSER_EGRESS_PROXY_UID, "BROWSER_EGRESS_PROXY_UID");
	if (process.getuid() !== expectedUid) throw new Error("Browser egress proxy is running under the wrong service UID");
	if (process.env.BROWSER_EGRESS_PROXY_URL?.trim() !== `http://${LISTEN_HOST}:${LISTEN_PORT}`) {
		throw new Error("Browser egress proxy URL does not match the fixed listener");
	}
	const approvedPath = fixedAbsolutePath(
		process.env.BROWSER_NETWORK_APPROVED_DOMAINS,
		"BROWSER_NETWORK_APPROVED_DOMAINS",
	);
	const controlPath = fixedAbsolutePath(
		process.env.BROWSER_NETWORK_CONTROL_PLANE_HOSTS,
		"BROWSER_NETWORK_CONTROL_PLANE_HOSTS",
	);
	const [approvedContent, controlContent] = await Promise.all([
		readRootOwnedFile(approvedPath),
		readRootOwnedFile(controlPath),
	]);
	const server = createEgressProxyServer({
		approvedHostnames: parseProxyHostList(approvedContent, false),
		controlPlaneHosts: parseProxyHostList(controlContent, true),
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(LISTEN_PORT, LISTEN_HOST, resolve);
	});
	process.stdout.write(`${JSON.stringify({ status: "ready", listener: "local_https_connect_only" })}\n`);
	await new Promise<void>((resolve) => {
		process.once("SIGINT", resolve);
		process.once("SIGTERM", resolve);
	});
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function readRootOwnedFile(filePath: string): Promise<string> {
	const stats = await lstat(filePath);
	if (!stats.isFile() || stats.isSymbolicLink() || stats.uid !== 0 || (stats.mode & 0o777) !== 0o644) {
		throw new Error("Browser egress proxy configuration must be a root-owned regular file with mode 0644");
	}
	if (stats.size > 64 * 1_024) throw new Error("Browser egress proxy configuration is too large");
	return readFile(filePath, "utf8");
}

function fixedAbsolutePath(value: string | undefined, name: string): string {
	const normalized = value?.trim();
	if (!normalized?.startsWith("/etc/yonaris-browser-runner/") || /[\0\r\n]/.test(normalized)) {
		throw new Error(`${name} must be an approved absolute configuration path`);
	}
	return normalized;
}

function positiveInteger(value: string | undefined, name: string): number {
	if (!value || !/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
	return parsed;
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : "Browser egress proxy failed"}\n`);
	process.exitCode = 1;
});
