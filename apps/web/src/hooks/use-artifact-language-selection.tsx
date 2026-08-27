import type { OutputLanguage } from "@workspace/config/language";
import { useEffect, useState } from "react";
import {
	type ArtifactLanguageStorage,
	type ArtifactLanguageSurface,
	artifactLanguageSelectionKey,
	persistArtifactLanguageSelection,
	resolveArtifactLanguageSelection,
} from "@/lib/artifact-language-selection";

type ArtifactLanguageSelectionState = {
	key: string;
	outputLanguage: OutputLanguage;
};

function browserSessionStorage(): ArtifactLanguageStorage | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		return window.sessionStorage;
	} catch {
		return undefined;
	}
}

export function useArtifactLanguageSelection(
	surface: ArtifactLanguageSurface,
	brandId: string | undefined,
	scopeId: string | undefined,
	seedLanguage: OutputLanguage,
): {
	outputLanguage: OutputLanguage;
	isResolved: boolean;
	setOutputLanguage: (nextLanguage: OutputLanguage) => void;
} {
	const key = brandId && scopeId ? artifactLanguageSelectionKey(surface, brandId, scopeId) : null;
	const [selection, setSelection] = useState<ArtifactLanguageSelectionState | null>(null);
	const current = key && selection?.key === key ? selection : null;

	useEffect(() => {
		if (!key || selection?.key === key) return;
		const outputLanguage = resolveArtifactLanguageSelection(browserSessionStorage(), key, seedLanguage);
		setSelection({ key, outputLanguage });
	}, [key, seedLanguage, selection?.key]);

	const setOutputLanguage = (nextLanguage: OutputLanguage) => {
		if (!key) return;
		persistArtifactLanguageSelection(browserSessionStorage(), key, nextLanguage);
		setSelection({ key, outputLanguage: nextLanguage });
	};

	return {
		outputLanguage: current?.outputLanguage ?? seedLanguage,
		isResolved: current !== null,
		setOutputLanguage,
	};
}
