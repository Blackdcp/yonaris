import { spawn } from "node:child_process";
import { chmod, lstat, unlink } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import path from "node:path";
import {
	BROKER_REQUEST_MAX_BYTES,
	BROKER_RESPONSE_MAX_BYTES,
	encodeBrokerFrame,
	parseBrokerRequest,
	readBrokerFrame,
} from "./broker-protocol.js";
import type { BrokerService } from "./broker-server.js";

type PeerHelperStat = {
	isFile(): boolean;
	isSymbolicLink(): boolean;
	uid: number;
	mode: number;
	nlink: number;
};

export type PeerVerifier = (socket: Socket) => Promise<void>;

export function assertPeerCredentialGate(input: {
	platform: NodeJS.Platform;
	brokerUid: number;
	allowedControlUid: number;
	helperStat: PeerHelperStat;
}): void {
	if (input.platform !== "linux") throw new Error("Browser broker peer credentials require Linux SO_PEERCRED");
	if (!Number.isSafeInteger(input.brokerUid) || input.brokerUid < 1) throw new Error("Browser broker UID is invalid");
	if (!Number.isSafeInteger(input.allowedControlUid) || input.allowedControlUid < 1) {
		throw new Error("Allowed control UID is invalid");
	}
	if (input.brokerUid === input.allowedControlUid) throw new Error("Control and browser broker require separate UIDs");
	if (
		!input.helperStat.isFile() ||
		input.helperStat.isSymbolicLink() ||
		input.helperStat.uid !== 0 ||
		input.helperStat.nlink !== 1
	) {
		throw new Error("SO_PEERCRED helper must be a root-owned regular file with one link");
	}
	if ((input.helperStat.mode & 0o022) !== 0) throw new Error("SO_PEERCRED helper must not be group/world writable");
	if ((input.helperStat.mode & 0o111) === 0) throw new Error("SO_PEERCRED helper must be executable");
}

export async function createLinuxPeerVerifier(options: {
	helperPath: string;
	allowedControlUid: number;
	brokerUid?: number;
}): Promise<PeerVerifier> {
	const helperPath = path.resolve(options.helperPath);
	if (!path.isAbsolute(options.helperPath) || options.helperPath.includes("\0")) {
		throw new Error("SO_PEERCRED helper path must be absolute");
	}
	const helperStat = await lstat(helperPath);
	const brokerUid = options.brokerUid ?? process.getuid?.();
	if (brokerUid === undefined) throw new Error("Browser broker cannot determine its Linux UID");
	assertPeerCredentialGate({
		platform: process.platform,
		brokerUid,
		allowedControlUid: options.allowedControlUid,
		helperStat,
	});
	return async (socket) => {
		const credentials = await readPeerCredentials(helperPath, socket);
		if (credentials.uid !== options.allowedControlUid) throw new Error("Unauthorized browser broker peer UID");
	};
}

export async function startBrokerSocketServer(options: {
	socketPath: string;
	service: BrokerService;
	verifyPeer: PeerVerifier;
	onConnectionError?: (error: unknown) => void;
}): Promise<{ close(): Promise<void> }> {
	const socketPath = options.socketPath;
	if (!socketPath.trim() || socketPath.includes("\0")) throw new Error("Broker socket path is invalid");
	if (process.platform !== "win32" && !path.isAbsolute(socketPath))
		throw new Error("Broker socket path must be absolute");
	if (process.platform !== "win32") await removeOwnedStaleSocket(socketPath);

	const connections = new Set<Socket>();
	const server = createServer({ allowHalfOpen: true }, (socket) => {
		connections.add(socket);
		// A control process can disappear while a long browser operation is still
		// finishing. Keep the per-response promise responsible for reporting that
		// failure, while this permanent listener prevents a later socket EPIPE from
		// becoming an uncaught process-level error.
		socket.on("error", () => undefined);
		socket.once("close", () => connections.delete(socket));
		socket.setTimeout(240_000, () => socket.destroy());
		void handleConnection(socket, options.service, options.verifyPeer, options.onConnectionError);
	});
	await listen(server, socketPath);
	if (process.platform !== "win32") await chmod(socketPath, 0o660);
	return {
		async close() {
			for (const socket of connections) socket.destroy();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				}),
			);
			if (process.platform !== "win32") await removeOwnedStaleSocket(socketPath);
		},
	};
}

async function handleConnection(
	socket: Socket,
	service: BrokerService,
	verifyPeer: PeerVerifier,
	onConnectionError?: (error: unknown) => void,
): Promise<void> {
	try {
		await verifyPeer(socket);
		const request = parseBrokerRequest(await readBrokerFrame(socket, BROKER_REQUEST_MAX_BYTES));
		const response = await service.handle(request);
		await endBrokerResponse(socket, encodeBrokerFrame(response, BROKER_RESPONSE_MAX_BYTES));
	} catch (error) {
		onConnectionError?.(error);
		socket.destroy();
	}
}

async function endBrokerResponse(socket: Socket, frame: Buffer): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const cleanup = () => socket.off("error", onError);
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		socket.once("error", onError);
		socket.end(frame, () => {
			cleanup();
			resolve();
		});
	});
}

async function readPeerCredentials(
	helperPath: string,
	socket: Socket,
): Promise<{ pid: number; uid: number; gid: number }> {
	return new Promise((resolve, reject) => {
		const child = spawn(helperPath, [], {
			stdio: ["ignore", "pipe", "pipe", socket],
			env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" },
		});
		let stdout = "";
		let stderrBytes = 0;
		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("SO_PEERCRED helper timed out"));
		}, 3_000);
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
			if (Buffer.byteLength(stdout) > 256) child.kill("SIGKILL");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderrBytes += chunk.byteLength;
			if (stderrBytes > 256) child.kill("SIGKILL");
		});
		child.once("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once("close", (code) => {
			clearTimeout(timeout);
			const match = /^(\d+) (\d+) (\d+)\n?$/.exec(stdout);
			if (code !== 0 || !match) {
				reject(new Error("SO_PEERCRED helper did not return valid credentials"));
				return;
			}
			resolve({ pid: Number(match[1]), uid: Number(match[2]), gid: Number(match[3]) });
		});
	});
}

async function removeOwnedStaleSocket(socketPath: string): Promise<void> {
	try {
		const socketStat = await lstat(socketPath);
		if (!socketStat.isSocket() || socketStat.isSymbolicLink() || socketStat.nlink !== 1) {
			throw new Error("Refusing to remove unsafe broker socket path");
		}
		const currentUid = process.getuid?.();
		if (currentUid === undefined || socketStat.uid !== currentUid) {
			throw new Error("Refusing to remove a broker socket owned by another UID");
		}
		await unlink(socketPath);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
		throw error;
	}
}

function listen(server: Server, socketPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(socketPath, () => {
			server.off("error", reject);
			resolve();
		});
	});
}
