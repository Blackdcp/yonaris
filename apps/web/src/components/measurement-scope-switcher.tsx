import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { parseScrapeTargets } from "@workspace/config/scrape-targets";
import { getObservationTargetCohort, resolveObservationTarget } from "@workspace/lib/observation-targets";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Globe2 } from "lucide-react";
import { useBrand } from "@/hooks/use-brands";
import { useFilterNavigate } from "@/hooks/use-list-filters";

function scopeLaneLabel(
	automaticTargetKeys: string[] | null,
	samplingEvaluationRole: "scored" | "observation" | null,
): string {
	if (samplingEvaluationRole === "scored") return "Scored sampling";
	if (samplingEvaluationRole === "observation") return "Observation pool";
	if (automaticTargetKeys === null) return "Legacy / unspecified";
	if (automaticTargetKeys.length === 0) return "Consumer / assisted";
	try {
		const cohorts = new Set(
			parseScrapeTargets(automaticTargetKeys.join(",")).map((target) =>
				getObservationTargetCohort(resolveObservationTarget(target)),
			),
		);
		return cohorts.has("consumer_measurement") ? "Consumer / search" : "API diagnostic";
	} catch {
		return "Configuration unavailable";
	}
}

export function MeasurementScopeSwitcher() {
	const { brand } = useBrand();
	const urlScope = useSearch({ strict: false, select: (search) => search.scope });
	const params = useParams({ strict: false }) as { brand?: string; promptId?: string };
	const navigate = useNavigate();
	const setFilters = useFilterNavigate();
	const scopes = brand?.measurementScopes.filter((scope) => scope.enabled) ?? [];
	const defaultScope = scopes.find((scope) => scope.isDefault) ?? scopes[0];
	const promptScopeId = params.promptId
		? brand?.prompts.find((prompt) => prompt.id === params.promptId)?.scopeId
		: undefined;
	const selected = scopes.find((scope) => scope.id === (promptScopeId ?? urlScope)) ?? defaultScope;

	if (!selected) return null;

	const label = `${selected.name} | ${selected.market}/${selected.locale} | ${scopeLaneLabel(selected.automaticTargetKeys, selected.samplingEvaluationRole)}`;
	const switchScope = (scopeId: string) => {
		const scope = scopeId === defaultScope?.id ? undefined : scopeId;
		if (params.promptId && params.brand) {
			navigate({ to: "/app/$brand/visibility", params: { brand: params.brand }, search: { scope } });
			return;
		}
		setFilters({ scope, model: undefined, tags: undefined, q: undefined });
	};
	if (scopes.length === 1) {
		return (
			<div className="hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs text-muted-foreground sm:flex">
				<Globe2 className="size-3.5" />
				<span>{label}</span>
			</div>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 max-w-72 gap-1.5 font-normal">
					<Globe2 className="size-3.5 text-muted-foreground" />
					<span className="truncate">{label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuRadioGroup value={selected.id} onValueChange={switchScope}>
					{scopes.map((scope) => (
						<DropdownMenuRadioItem key={scope.id} value={scope.id} className="cursor-pointer">
							<div className="min-w-0">
								<div className="truncate text-sm">{scope.name}</div>
								<div className="text-xs text-muted-foreground">
									{scope.market} / {scope.locale} / {scope.timezone} /{" "}
									{scopeLaneLabel(scope.automaticTargetKeys, scope.samplingEvaluationRole)}
								</div>
							</div>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
