import { isContentLanguage, type OutputLanguage } from "@workspace/config/language";

export type ArtifactLanguageSurface = "opportunities-admin" | "opportunities-customer";
export type ArtifactLanguageStorage = Pick<Storage, "getItem" | "setItem">;

const ARTIFACT_LANGUAGE_SELECTION_PREFIX = "yonaris:artifact-output-language:v1";

export const REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY = `${ARTIFACT_LANGUAGE_SELECTION_PREFIX}:report-create`;

export function artifactLanguageSelectionKey(
	surface: ArtifactLanguageSurface,
	brandId: string,
	scopeId: string,
): string {
	return `${ARTIFACT_LANGUAGE_SELECTION_PREFIX}:${surface}:${encodeURIComponent(brandId)}:${encodeURIComponent(scopeId)}`;
}

export function persistArtifactLanguageSelection(
	storage: ArtifactLanguageStorage | undefined,
	key: string,
	outputLanguage: OutputLanguage,
): void {
	try {
		storage?.setItem(key, outputLanguage);
	} catch {
		// Some privacy modes expose sessionStorage but throw when it is accessed.
	}
}

export function resolveArtifactLanguageSelection(
	storage: ArtifactLanguageStorage | undefined,
	key: string,
	seedLanguage: OutputLanguage,
): OutputLanguage {
	try {
		const stored = storage?.getItem(key);
		if (isContentLanguage(stored)) return stored;
	} catch {
		return seedLanguage;
	}

	persistArtifactLanguageSelection(storage, key, seedLanguage);
	return seedLanguage;
}
