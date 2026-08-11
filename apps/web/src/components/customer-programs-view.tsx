import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Info, LockKeyhole } from "lucide-react";
import { MeasurementScopeProvisionDialog } from "@/components/measurement-scope-provision-dialog";
import type { ProvisionSamplingScopeInput, SamplingEvaluationRole } from "@/components/sampling/types";

export interface CustomerProgramView {
	id: string;
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	enabled: boolean;
	isDefault: boolean;
	manualOnly: boolean;
	samplingEvaluationRole: SamplingEvaluationRole | null;
	promptCount: number;
	enabledPromptCount: number;
}

export interface CustomerProgramsContextView {
	brand: { id: string; name: string };
	canProvision: boolean;
	programs: CustomerProgramView[];
}

export function CustomerProgramsView({
	context,
	onProvision,
}: {
	context: CustomerProgramsContextView;
	onProvision: (input: ProvisionSamplingScopeInput) => Promise<{ copiedPromptCount: number }>;
}) {
	const sources = context.programs.map((program) => ({
		id: program.id,
		name: program.name,
		enabledPromptCount: program.enabledPromptCount,
	}));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Programs</h1>
					<p className="mt-1 text-muted-foreground">
						Manage the market, language, timezone, and evaluation lane for {context.brand.name}.
					</p>
				</div>
				{context.canProvision ? (
					<MeasurementScopeProvisionDialog
						brandId={context.brand.id}
						sources={sources}
						onProvision={onProvision}
						defaultSource="none"
						copy={{
							trigger: "Create program",
							title: "Create program scope",
							description: "Define one market-specific, manual-only measurement scope for this brand.",
							submit: "Create program scope",
							successTitle: "Program ready",
						}}
					/>
				) : (
					<Badge variant="outline">
						<LockKeyhole />
						Read-only
					</Badge>
				)}
			</div>

			<Alert>
				<Info />
				<AlertTitle>Program means measurement scope</AlertTitle>
				<AlertDescription>
					In this release, each program is represented by one measurement scope. Creating one does not schedule or run
					sampling; a batch is still a separate execution.
				</AlertDescription>
			</Alert>

			{!context.canProvision && (
				<Alert>
					<LockKeyhole />
					<AlertTitle>View access</AlertTitle>
					<AlertDescription>
						Only organization owners and admins can create programs. Your current membership can view this brand's
						program definitions without changing them.
					</AlertDescription>
				</Alert>
			)}

			{context.programs.length === 0 ? (
				<Card>
					<CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
						<p className="font-medium">No programs yet</p>
						<p className="max-w-lg text-sm text-muted-foreground">
							Create a manual-only scope for an explicit market, locale, timezone, and fixed evaluation lane.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="py-0">
					<CardContent className="overflow-x-auto px-0">
						<Table className="min-w-[800px]">
							<TableHeader>
								<TableRow>
									<TableHead className="pl-6">Program</TableHead>
									<TableHead>Market context</TableHead>
									<TableHead>Evaluation lane</TableHead>
									<TableHead>Prompts</TableHead>
									<TableHead>Delivery</TableHead>
									<TableHead className="pr-6">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{context.programs.map((program) => (
									<TableRow key={program.id}>
										<TableCell className="pl-6">
											<div className="font-medium">{program.name}</div>
											<code className="text-xs text-muted-foreground">{program.key}</code>
										</TableCell>
										<TableCell>
											<div>
												{program.market} / {program.locale}
											</div>
											<div className="text-xs text-muted-foreground">{program.timezone}</div>
										</TableCell>
										<TableCell>{evaluationLane(program.samplingEvaluationRole)}</TableCell>
										<TableCell>
											<span className="tabular-nums">{program.enabledPromptCount}</span> enabled
											<span className="text-muted-foreground"> / {program.promptCount} total</span>
										</TableCell>
										<TableCell>
											<Badge variant={program.manualOnly ? "secondary" : "outline"}>
												{program.manualOnly ? "Manual only" : "Automatic targets"}
											</Badge>
										</TableCell>
										<TableCell className="pr-6">
											<div className="flex flex-wrap gap-1.5">
												<Badge variant={program.enabled ? "secondary" : "outline"}>
													{program.enabled ? "Enabled" : "Disabled"}
												</Badge>
												{program.isDefault && <Badge variant="outline">Default</Badge>}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function evaluationLane(role: SamplingEvaluationRole | null) {
	if (role === "scored") return <Badge>Scored</Badge>;
	if (role === "observation") return <Badge variant="secondary">Observation</Badge>;
	return <Badge variant="outline">Not assigned</Badge>;
}
