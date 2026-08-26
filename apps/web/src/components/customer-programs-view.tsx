import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Info, LockKeyhole } from "lucide-react";
import { MeasurementScopeProvisionDialog } from "@/components/measurement-scope-provision-dialog";
import type { ProvisionSamplingScopeInput, SamplingEvaluationRole } from "@/components/sampling/types";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";

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
	const { t, formatNumber } = useI18n();
	const sources = context.programs.map((program) => ({
		id: program.id,
		name: program.name,
		enabledPromptCount: program.enabledPromptCount,
	}));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{t("program.title")}</h1>
					<p className="mt-1 text-muted-foreground">{t("program.description", { brand: context.brand.name })}</p>
				</div>
				{context.canProvision ? (
					<MeasurementScopeProvisionDialog
						brandId={context.brand.id}
						sources={sources}
						onProvision={onProvision}
						defaultSource="none"
						copy={{
							trigger: t("program.create"),
							title: t("program.createTitle"),
							description: t("program.createDescription"),
							submit: t("program.createSubmit"),
							successTitle: t("program.ready"),
						}}
					/>
				) : (
					<Badge variant="outline">
						<LockKeyhole />
						{t("program.readOnly")}
					</Badge>
				)}
			</div>

			<Alert>
				<Info />
				<AlertTitle>{t("program.scopeMeaningTitle")}</AlertTitle>
				<AlertDescription>{t("program.scopeMeaningDescription")}</AlertDescription>
			</Alert>

			{!context.canProvision && (
				<Alert>
					<LockKeyhole />
					<AlertTitle>{t("program.viewAccess")}</AlertTitle>
					<AlertDescription>{t("program.viewAccessDescription")}</AlertDescription>
				</Alert>
			)}

			{context.programs.length === 0 ? (
				<Card>
					<CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
						<p className="font-medium">{t("program.empty")}</p>
						<p className="max-w-lg text-sm text-muted-foreground">{t("program.emptyDescription")}</p>
					</CardContent>
				</Card>
			) : (
				<Card className="py-0">
					<CardContent className="overflow-x-auto px-0">
						<Table className="min-w-[800px]">
							<TableHeader>
								<TableRow>
									<TableHead className="pl-6">{t("program.column.program")}</TableHead>
									<TableHead>{t("program.column.market")}</TableHead>
									<TableHead>{t("program.column.lane")}</TableHead>
									<TableHead>{t("program.column.prompts")}</TableHead>
									<TableHead>{t("program.column.delivery")}</TableHead>
									<TableHead className="pr-6">{t("program.column.status")}</TableHead>
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
										<TableCell>{evaluationLane(program.samplingEvaluationRole, t)}</TableCell>
										<TableCell>
											{t("program.promptCounts", {
												enabled: formatNumber(program.enabledPromptCount),
												total: formatNumber(program.promptCount),
											})}
										</TableCell>
										<TableCell>
											<Badge variant={program.manualOnly ? "secondary" : "outline"}>
												{program.manualOnly ? t("program.delivery.manual") : t("program.delivery.automatic")}
											</Badge>
										</TableCell>
										<TableCell className="pr-6">
											<div className="flex flex-wrap gap-1.5">
												<Badge variant={program.enabled ? "secondary" : "outline"}>
													{program.enabled ? t("program.status.enabled") : t("program.status.disabled")}
												</Badge>
												{program.isDefault && <Badge variant="outline">{t("program.status.default")}</Badge>}
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

const laneMessageIds: Record<SamplingEvaluationRole, MessageId> = {
	scored: "program.lane.scored",
	observation: "program.lane.observation",
};

function evaluationLane(role: SamplingEvaluationRole | null, t: (id: MessageId) => string) {
	if (role === "scored") return <Badge>{t(laneMessageIds.scored)}</Badge>;
	if (role === "observation") return <Badge variant="secondary">{t(laneMessageIds.observation)}</Badge>;
	return <Badge variant="outline">{t("program.lane.unassigned")}</Badge>;
}
