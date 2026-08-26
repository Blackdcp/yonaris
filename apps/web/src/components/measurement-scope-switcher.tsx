import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
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
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { CustomerMeasurementScopeDto } from "@/server/customer-data-dto";

function scopeLaneLabel(
	scope: Pick<CustomerMeasurementScopeDto, "deliveryMode" | "lane">,
	t: (id: MessageId) => string,
): string {
	if (scope.lane === "scored") return t("filter.scope.scored");
	if (scope.lane === "observation") return t("filter.scope.observation");
	if (scope.deliveryMode === "legacy") return t("filter.scope.legacy");
	if (scope.deliveryMode === "assisted") return t("filter.scope.assisted");
	if (scope.lane === "consumer") return t("filter.scope.consumer");
	if (scope.lane === "diagnostic") return t("filter.scope.diagnostic");
	return t("filter.scope.unavailable");
}

export function MeasurementScopeSwitcher() {
	const { t } = useI18n();
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

	const label = `${selected.name} | ${selected.market}/${selected.locale} | ${scopeLaneLabel(selected, t)}`;
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
									{scope.market} / {scope.locale} / {scope.timezone} / {scopeLaneLabel(scope, t)}
								</div>
							</div>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
