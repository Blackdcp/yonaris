import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { OpportunitiesResponse } from "@/server/opportunities";
import { type AdminOpportunityBrand, getOpportunityScopesForBrand } from "@/server/opportunities-admin-scopes";

export function opportunityGenerationMessage(result: OpportunitiesResponse): string {
	if (!result.report) {
		if (result.reason === "insufficient-data") {
			return "No report was generated: this Program needs more tracking data.";
		}
		return "No report was generated for this Program.";
	}
	return result.generatedFor ? "Opportunities report generated." : "Current opportunities report is already available.";
}

export function OpportunitiesGenerationControl({
	onGenerate,
	brands = [],
}: {
	onGenerate(input: { brandId: string; scopeId: string }): Promise<OpportunitiesResponse>;
	brands?: AdminOpportunityBrand[];
}) {
	const [brandId, setBrandId] = useState("");
	const [scopeId, setScopeId] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const generate = async () => {
		if (!brandId || !scopeId) {
			setMessage("Select both a brand and a Program.");
			return;
		}
		setIsLoading(true);
		setMessage(null);
		try {
			const result = await onGenerate({ brandId, scopeId });
			setMessage(opportunityGenerationMessage(result));
		} catch (caught) {
			setMessage(caught instanceof Error ? caught.message : "Could not generate the opportunities report.");
		} finally {
			setIsLoading(false);
		}
	};
	const scopes = getOpportunityScopesForBrand(brands, brandId);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="size-5" />
					Generate opportunities report
				</CardTitle>
				<CardDescription>
					Explicitly generate a report for one measurement scope. Customer report reads never start this work.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2">
					<Label htmlFor="opportunities-brand">Brand</Label>
					<select
						id="opportunities-brand"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={brandId}
						onChange={(event) => {
							setBrandId(event.target.value);
							setScopeId("");
						}}
					>
						<option value="">Select a brand</option>
						{brands.map((brand) => (
							<option key={brand.id} value={brand.id}>
								{brand.name}
							</option>
						))}
					</select>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="opportunities-program">Program</Label>
					<select
						id="opportunities-program"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={scopeId}
						onChange={(event) => setScopeId(event.target.value)}
						disabled={!brandId}
					>
						<option value="">Select a Program</option>
						{scopes.map((scope) => (
							<option key={scope.id} value={scope.id}>
								{scope.name} · {scope.market} · {scope.locale} · {scope.promptCount} enabled prompts
							</option>
						))}
					</select>
				</div>
				<Button className="w-full cursor-pointer" onClick={generate} disabled={isLoading || !brandId || !scopeId}>
					{isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
					Generate report
				</Button>
				{message && <p className="text-sm text-muted-foreground">{message}</p>}
			</CardContent>
		</Card>
	);
}
