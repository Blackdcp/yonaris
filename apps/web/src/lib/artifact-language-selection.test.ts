import type { OutputLanguage } from "@workspace/config/language";
import { describe, expect, it, vi } from "vitest";
import {
	type ArtifactLanguageStorage,
	artifactLanguageSelectionKey,
	persistArtifactLanguageSelection,
	REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY,
	resolveArtifactLanguageSelection,
} from "./artifact-language-selection";

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

describe("artifactLanguageSelectionKey", () => {
	it("exposes the standalone report-create key without coupling it to Opportunity identity", () => {
		expect(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY).toBe("yonaris:artifact-output-language:v1:report-create");
		expect(REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY).not.toBe(
			artifactLanguageSelectionKey("opportunities-admin", "report-create", "report-create"),
		);
	});

	it("uses exact surface-specific, brand-specific, and scope-specific tab keys", () => {
		expect(artifactLanguageSelectionKey("opportunities-admin", "brand/CN &", "scope:scored/1")).toBe(
			"yonaris:artifact-output-language:v1:opportunities-admin:brand%2FCN%20%26:scope%3Ascored%2F1",
		);
		expect(artifactLanguageSelectionKey("opportunities-customer", "brand", "scope")).toBe(
			"yonaris:artifact-output-language:v1:opportunities-customer:brand:scope",
		);
	});

	it("keeps admin, customer, brand, and Program selections independent", () => {
		const keys = new Set([
			artifactLanguageSelectionKey("opportunities-admin", "brand-a", "scope-a"),
			artifactLanguageSelectionKey("opportunities-customer", "brand-a", "scope-a"),
			artifactLanguageSelectionKey("opportunities-admin", "brand-b", "scope-a"),
			artifactLanguageSelectionKey("opportunities-admin", "brand-a", "scope-b"),
		]);

		expect(keys).toHaveLength(4);
	});
});

describe("resolveArtifactLanguageSelection", () => {
	const key = artifactLanguageSelectionKey("opportunities-admin", "brand", "scope");

	it.each(["en", "zh-CN"] satisfies OutputLanguage[])(
		"restores the exact stored %s token without reseeding",
		(stored) => {
			const storage = memoryStorage({ [key]: stored });

			expect(resolveArtifactLanguageSelection(storage, key, stored === "en" ? "zh-CN" : "en")).toBe(stored);
			expect(storage.setItem).not.toHaveBeenCalled();
		},
	);

	it.each([null, "", "zh", "CN", "zh-SG"])("seeds missing or invalid storage value %s immediately", (stored) => {
		const storage = memoryStorage(stored === null ? {} : { [key]: stored });

		expect(resolveArtifactLanguageSelection(storage, key, "zh-CN")).toBe("zh-CN");
		expect(storage.values.get(key)).toBe("zh-CN");
		expect(storage.setItem).toHaveBeenCalledWith(key, "zh-CN");
	});

	it("uses the seed safely when storage is unavailable", () => {
		expect(resolveArtifactLanguageSelection(undefined, key, "zh-CN")).toBe("zh-CN");
	});

	it("uses the seed safely when session storage reads or writes throw SecurityError", () => {
		const readFailure: ArtifactLanguageStorage = {
			getItem: () => {
				throw Object.assign(new Error("blocked"), { name: "SecurityError" });
			},
			setItem: vi.fn(),
		};
		const writeFailure: ArtifactLanguageStorage = {
			getItem: () => null,
			setItem: () => {
				throw Object.assign(new Error("blocked"), { name: "SecurityError" });
			},
		};

		expect(resolveArtifactLanguageSelection(readFailure, key, "en")).toBe("en");
		expect(resolveArtifactLanguageSelection(writeFailure, key, "zh-CN")).toBe("zh-CN");
	});
});

describe("persistArtifactLanguageSelection", () => {
	it("persists the exact user selection synchronously and tolerates SecurityError", () => {
		const key = artifactLanguageSelectionKey("opportunities-customer", "brand", "scope");
		const storage = memoryStorage();

		persistArtifactLanguageSelection(storage, key, "zh-CN");
		expect(storage.values.get(key)).toBe("zh-CN");

		expect(() =>
			persistArtifactLanguageSelection(
				{
					getItem: () => null,
					setItem: () => {
						throw Object.assign(new Error("blocked"), { name: "SecurityError" });
					},
				},
				key,
				"en",
			),
		).not.toThrow();
	});
});
