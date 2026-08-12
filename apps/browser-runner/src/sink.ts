import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObservationSink, SuccessfulRunnerObservation } from "./contracts.js";

export class LocalObservationSink implements ObservationSink {
	readonly retainLocalArtifacts = true;
	readonly #directory: string;

	constructor(runDirectory: string) {
		this.#directory = path.join(runDirectory, "observations");
	}

	async submit(observation: SuccessfulRunnerObservation): Promise<void> {
		await mkdir(this.#directory, { recursive: true, mode: 0o700 });
		await chmod(this.#directory, 0o700);
		const outputPath = path.join(this.#directory, `${safeName(observation.task.id)}.json`);
		try {
			const existing = JSON.parse(await readFile(outputPath, "utf8")) as SuccessfulRunnerObservation;
			if (existing.idempotencyKey !== observation.idempotencyKey) {
				throw new Error(`Observation file for task ${observation.task.id} has a different idempotency key`);
			}
			return;
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}
		await writeFile(outputPath, `${JSON.stringify(observation, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await chmod(outputPath, 0o600);
	}
}

function isNotFound(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function safeName(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}
