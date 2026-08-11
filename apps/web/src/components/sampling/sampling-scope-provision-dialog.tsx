import { useMemo } from "react";
import { MeasurementScopeProvisionDialog } from "@/components/measurement-scope-provision-dialog";
import type { ProvisionSamplingScopeInput, SamplingContextView } from "./types";

export function SamplingScopeProvisionDialog({
	context,
	onProvision,
}: {
	context: SamplingContextView;
	onProvision: (input: ProvisionSamplingScopeInput) => Promise<{ copiedPromptCount: number }>;
}) {
	const brand = context.selectedBrand;
	const enabledPromptCountByScope = useMemo(() => {
		const counts = new Map<string, number>();
		for (const prompt of brand?.prompts ?? []) {
			if (!prompt.enabled || !prompt.scopeId) continue;
			counts.set(prompt.scopeId, (counts.get(prompt.scopeId) ?? 0) + 1);
		}
		return counts;
	}, [brand?.prompts]);
	const sources = useMemo(
		() =>
			brand?.scopes.map((scope) => ({
				id: scope.id,
				name: scope.name,
				enabledPromptCount: enabledPromptCountByScope.get(scope.id) ?? 0,
			})) ?? [],
		[brand?.scopes, enabledPromptCountByScope],
	);

	if (!brand) return null;

	return <MeasurementScopeProvisionDialog brandId={brand.id} sources={sources} onProvision={onProvision} />;
}
