import type { BrowserExtensionClaim } from "../contracts";

type AdaptiveSurfacePoolOptions = {
	initial?: number;
	minimum?: number;
	maximum?: number;
	successWindow?: number;
	baseCooldownMs?: number;
	maximumCooldownMs?: number;
};

export class AdaptiveSurfacePool {
	readonly #minimum: number;
	readonly #maximum: number;
	readonly #successWindow: number;
	readonly #baseCooldownMs: number;
	readonly #maximumCooldownMs: number;
	#current: number;
	#stableSuccesses = 0;
	#rateLimitStreak = 0;
	#cooldownUntil = 0;

	constructor(options: AdaptiveSurfacePoolOptions = {}) {
		this.#minimum = positiveInteger(options.minimum ?? 1, "minimum");
		this.#maximum = positiveInteger(options.maximum ?? 1, "maximum");
		this.#current = positiveInteger(options.initial ?? 1, "initial");
		this.#successWindow = positiveInteger(options.successWindow ?? 5, "successWindow");
		this.#baseCooldownMs = positiveInteger(options.baseCooldownMs ?? 60_000, "baseCooldownMs");
		this.#maximumCooldownMs = positiveInteger(options.maximumCooldownMs ?? 15 * 60_000, "maximumCooldownMs");
		if (this.#minimum > this.#maximum || this.#current < this.#minimum || this.#current > this.#maximum) {
			throw new Error("Adaptive surface concurrency bounds are invalid");
		}
	}

	get current(): number {
		return this.#current;
	}

	get cooldownUntil(): number {
		return this.#cooldownUntil;
	}

	canStart(now = Date.now()): boolean {
		return now >= this.#cooldownUntil;
	}

	recordStableSuccess(): void {
		this.#rateLimitStreak = 0;
		this.#stableSuccesses += 1;
		if (this.#stableSuccesses < this.#successWindow) return;
		this.#stableSuccesses = 0;
		this.#current = Math.min(this.#maximum, this.#current + 1);
	}

	recordRateLimit(now = Date.now()): void {
		this.#stableSuccesses = 0;
		this.#rateLimitStreak += 1;
		this.#current = Math.max(this.#minimum, Math.floor(this.#current / 2));
		const cooldown = Math.min(
			this.#maximumCooldownMs,
			this.#baseCooldownMs * 2 ** Math.min(this.#rateLimitStreak - 1, 8),
		);
		this.#cooldownUntil = now + cooldown;
	}
}

export function orderClaimsFairly(claims: readonly BrowserExtensionClaim[]): BrowserExtensionClaim[] {
	return [...claims].sort(
		(left, right) =>
			left.sampleIndex - right.sampleIndex ||
			left.promptId.localeCompare(right.promptId) ||
			left.taskId.localeCompare(right.taskId),
	);
}

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
	return value;
}
