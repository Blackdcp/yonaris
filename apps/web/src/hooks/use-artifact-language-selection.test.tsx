import type { OutputLanguage } from "@workspace/config/language";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
	states: [] as unknown[],
	stateCursor: 0,
	effectDependencies: [] as Array<readonly unknown[] | undefined>,
	effectCursor: 0,
	pendingEffects: [] as Array<() => void>,
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useState<T>(initial: T | (() => T)) {
			const index = harness.stateCursor++;
			if (!(index in harness.states)) {
				harness.states[index] = typeof initial === "function" ? (initial as () => T)() : initial;
			}
			const setState = (next: T | ((previous: T) => T)) => {
				const previous = harness.states[index] as T;
				harness.states[index] = typeof next === "function" ? (next as (value: T) => T)(previous) : next;
			};
			return [harness.states[index] as T, setState] as const;
		},
		useEffect(effect: () => void, dependencies?: readonly unknown[]) {
			const index = harness.effectCursor++;
			const previous = harness.effectDependencies[index];
			const changed =
				previous === undefined ||
				dependencies === undefined ||
				previous.length !== dependencies.length ||
				dependencies.some((dependency, dependencyIndex) => !Object.is(dependency, previous[dependencyIndex]));
			if (changed) {
				harness.effectDependencies[index] = dependencies;
				harness.pendingEffects.push(effect);
			}
		},
	};
});

import { type ArtifactLanguageStorage, artifactLanguageSelectionKey } from "@/lib/artifact-language-selection";
import { useArtifactLanguageSelection as invokeArtifactLanguageSelection } from "./use-artifact-language-selection";

function memoryStorage(
	initial: Record<string, string> = {},
): ArtifactLanguageStorage & { values: Map<string, string> } {
	const values = new Map(Object.entries(initial));
	return {
		values,
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
	};
}

function resetHook() {
	harness.states.length = 0;
	harness.stateCursor = 0;
	harness.effectDependencies.length = 0;
	harness.effectCursor = 0;
	harness.pendingEffects.length = 0;
}

function renderSelection(
	seedLanguage: OutputLanguage,
	brandId: string | undefined = "brand",
	scopeId: string | undefined = "scope",
	surface: "opportunities-admin" | "opportunities-customer" = "opportunities-admin",
) {
	harness.stateCursor = 0;
	harness.effectCursor = 0;
	return invokeArtifactLanguageSelection(surface, brandId, scopeId, seedLanguage);
}

function flushEffects() {
	const effects = harness.pendingEffects.splice(0);
	for (const effect of effects) effect();
}

describe("useArtifactLanguageSelection", () => {
	beforeEach(() => {
		resetHook();
		vi.unstubAllGlobals();
	});

	it("returns an unresolved seed during SSR without reading browser state", () => {
		const selection = renderSelection("zh-CN");

		expect(selection).toMatchObject({ outputLanguage: "zh-CN", isResolved: false });
	});

	it("resolves and seeds a missing browser selection only after the effect", () => {
		const storage = memoryStorage();
		vi.stubGlobal("window", { sessionStorage: storage });
		const key = artifactLanguageSelectionKey("opportunities-admin", "brand", "scope");

		expect(renderSelection("en")).toMatchObject({ outputLanguage: "en", isResolved: false });
		flushEffects();
		expect(renderSelection("en")).toMatchObject({ outputLanguage: "en", isResolved: true });
		expect(storage.values.get(key)).toBe("en");
	});

	it("restores a stored selection after a full remount even when the UI seed changes", () => {
		const key = artifactLanguageSelectionKey("opportunities-admin", "brand", "scope");
		const storage = memoryStorage({ [key]: "zh-CN" });
		vi.stubGlobal("window", { sessionStorage: storage });

		renderSelection("en");
		flushEffects();
		expect(renderSelection("en").outputLanguage).toBe("zh-CN");

		resetHook();
		renderSelection("en");
		flushEffects();
		expect(renderSelection("en")).toMatchObject({ outputLanguage: "zh-CN", isResolved: true });
	});

	it("does not reseed a resolved key when the live UI language changes", () => {
		const storage = memoryStorage();
		vi.stubGlobal("window", { sessionStorage: storage });

		renderSelection("en");
		flushEffects();
		expect(renderSelection("en").outputLanguage).toBe("en");
		expect(renderSelection("zh-CN")).toMatchObject({ outputLanguage: "en", isResolved: true });
		flushEffects();
		expect(renderSelection("zh-CN").outputLanguage).toBe("en");
	});

	it("becomes unresolved immediately when the brand or Program storage key changes", () => {
		const oldKey = artifactLanguageSelectionKey("opportunities-customer", "brand", "scope-a");
		const newKey = artifactLanguageSelectionKey("opportunities-customer", "brand", "scope-b");
		const storage = memoryStorage({ [oldKey]: "en", [newKey]: "zh-CN" });
		vi.stubGlobal("window", { sessionStorage: storage });

		renderSelection("en", "brand", "scope-a", "opportunities-customer");
		flushEffects();
		expect(renderSelection("en", "brand", "scope-a", "opportunities-customer")).toMatchObject({
			outputLanguage: "en",
			isResolved: true,
		});
		expect(renderSelection("en", "brand", "scope-b", "opportunities-customer")).toMatchObject({
			outputLanguage: "en",
			isResolved: false,
		});
		flushEffects();
		expect(renderSelection("en", "brand", "scope-b", "opportunities-customer")).toMatchObject({
			outputLanguage: "zh-CN",
			isResolved: true,
		});
	});

	it("persists a user selection synchronously and exposes it on the next render", () => {
		const key = artifactLanguageSelectionKey("opportunities-admin", "brand", "scope");
		const storage = memoryStorage({ [key]: "en" });
		vi.stubGlobal("window", { sessionStorage: storage });
		renderSelection("en");
		flushEffects();

		const selection = renderSelection("en");
		selection.setOutputLanguage("zh-CN");
		expect(storage.values.get(key)).toBe("zh-CN");
		expect(renderSelection("en")).toMatchObject({ outputLanguage: "zh-CN", isResolved: true });
	});

	it("resolves in memory when access to window.sessionStorage throws SecurityError", () => {
		const blockedWindow = Object.defineProperty({}, "sessionStorage", {
			get() {
				throw Object.assign(new Error("blocked"), { name: "SecurityError" });
			},
		});
		vi.stubGlobal("window", blockedWindow);

		renderSelection("zh-CN");
		flushEffects();
		expect(renderSelection("zh-CN")).toMatchObject({ outputLanguage: "zh-CN", isResolved: true });
		expect(() => renderSelection("zh-CN").setOutputLanguage("en")).not.toThrow();
		expect(renderSelection("zh-CN").outputLanguage).toBe("en");
	});

	it("stays unresolved until both brand and Program identities exist", () => {
		const storage = memoryStorage();
		vi.stubGlobal("window", { sessionStorage: storage });

		expect(renderSelection("en", "", "scope").isResolved).toBe(false);
		flushEffects();
		expect(renderSelection("en", "brand", "").isResolved).toBe(false);
		expect(storage.setItem).not.toHaveBeenCalled();
	});
});
