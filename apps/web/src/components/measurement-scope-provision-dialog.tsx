import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { CheckCircle2, Loader2, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProvisionSamplingScopeInput, SamplingEvaluationRole } from "@/components/sampling/types";

export interface MeasurementScopeProvisionSource {
	id: string;
	name: string;
	enabledPromptCount: number;
}

interface MeasurementScopeProvisionDialogCopy {
	trigger: string;
	title: string;
	description: string;
	submit: string;
	successTitle: string;
}

const defaultCopy: MeasurementScopeProvisionDialogCopy = {
	trigger: "Provision scope",
	title: "Provision sampling scope",
	description: "Create an explicit market, language, and timezone context for manual consumer-surface sampling.",
	submit: "Create manual scope",
	successTitle: "Scope ready",
};

function detectedTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

function isValidLocale(locale: string): boolean {
	try {
		return Intl.getCanonicalLocales(locale).length === 1 && Intl.getCanonicalLocales(locale)[0] !== "und";
	} catch {
		return false;
	}
}

function isValidTimezone(timezone: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
		return true;
	} catch {
		return false;
	}
}

export function MeasurementScopeProvisionDialog({
	brandId,
	sources,
	onProvision,
	copy,
	defaultSource = "first-with-prompts",
}: {
	brandId: string;
	sources: readonly MeasurementScopeProvisionSource[];
	onProvision: (input: ProvisionSamplingScopeInput) => Promise<{ copiedPromptCount: number }>;
	copy?: Partial<MeasurementScopeProvisionDialogCopy>;
	defaultSource?: "first-with-prompts" | "none";
}) {
	const labels = { ...defaultCopy, ...copy };
	const initialSourceScopeId =
		defaultSource === "first-with-prompts"
			? (sources.find((scope) => scope.enabledPromptCount > 0)?.id ?? "none")
			: "none";
	const [open, setOpen] = useState(false);
	const [key, setKey] = useState("");
	const [name, setName] = useState("");
	const [market, setMarket] = useState("");
	const [locale, setLocale] = useState("");
	const [timezone, setTimezone] = useState(detectedTimezone);
	const [evaluationRole, setEvaluationRole] = useState<SamplingEvaluationRole>("scored");
	const [sourceScopeId, setSourceScopeId] = useState("none");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !brandId) return;
		setKey("");
		setName("");
		setMarket("");
		setLocale("");
		setTimezone(detectedTimezone());
		setEvaluationRole("scored");
		setSourceScopeId(initialSourceScopeId);
		setError(null);
		setSuccess(null);
	}, [brandId, initialSourceScopeId, open]);

	const handleSubmit = async () => {
		const normalizedKey = key.trim().toLowerCase();
		const normalizedMarket = market.trim().toUpperCase();
		const normalizedLocale = locale.trim();
		const normalizedTimezone = timezone.trim();
		if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(normalizedKey)) {
			setError("Key must be a lowercase slug using letters, numbers, hyphens, or underscores.");
			return;
		}
		if (!name.trim()) {
			setError("Scope name is required.");
			return;
		}
		if (!/^[A-Z]{2}$/.test(normalizedMarket) || normalizedMarket === "ZZ") {
			setError("Market must be an explicit two-letter ISO-style code, such as CN, US, SG, or JP.");
			return;
		}
		if (!isValidLocale(normalizedLocale)) {
			setError("Locale must be a valid explicit BCP 47 tag, such as zh-CN, en-US, or ja-JP.");
			return;
		}
		if (!isValidTimezone(normalizedTimezone)) {
			setError("Timezone must be a valid IANA name, such as Asia/Shanghai or America/New_York.");
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const result = await onProvision({
				brandId,
				key: normalizedKey,
				name: name.trim(),
				market: normalizedMarket,
				locale: normalizedLocale,
				timezone: normalizedTimezone,
				evaluationRole,
				...(sourceScopeId === "none" ? {} : { sourceScopeId }),
			});
			setSuccess(
				`Manual-only scope created. ${result.copiedPromptCount} enabled prompt${result.copiedPromptCount === 1 ? "" : "s"} copied.`,
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to provision the measurement scope.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<MapPinned />
					{labels.trigger}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{labels.title}</DialogTitle>
					<DialogDescription>{labels.description}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-key">Key</Label>
						<Input
							id="measurement-scope-key"
							value={key}
							onChange={(event) => setKey(event.target.value.toLowerCase())}
							placeholder="cn-zh"
							maxLength={64}
							disabled={submitting || Boolean(success)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-name">Name</Label>
						<Input
							id="measurement-scope-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="China - Simplified Chinese"
							maxLength={120}
							disabled={submitting || Boolean(success)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-market">Market</Label>
						<Input
							id="measurement-scope-market"
							value={market}
							onChange={(event) => setMarket(event.target.value.toUpperCase())}
							placeholder="CN"
							maxLength={2}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">Two-letter ISO-style market code.</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-locale">Locale</Label>
						<Input
							id="measurement-scope-locale"
							value={locale}
							onChange={(event) => setLocale(event.target.value)}
							placeholder="zh-CN"
							maxLength={35}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">BCP 47 language tag.</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label>Evaluation pool</Label>
						<Select
							value={evaluationRole}
							onValueChange={(value: SamplingEvaluationRole) => setEvaluationRole(value)}
							disabled={submitting || Boolean(success)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="scored">Scored - counts toward assessment</SelectItem>
								<SelectItem value="observation">Observation - monitoring only</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							The role is fixed for this scope; provision another scope for the other pool.
						</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="measurement-scope-timezone">Timezone</Label>
						<Input
							id="measurement-scope-timezone"
							value={timezone}
							onChange={(event) => setTimezone(event.target.value)}
							placeholder="Asia/Shanghai"
							maxLength={100}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">IANA timezone; browser detection is only a default.</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label>Copy enabled prompts from</Label>
						<Select value={sourceScopeId} onValueChange={setSourceScopeId} disabled={submitting || Boolean(success)}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Do not copy prompts</SelectItem>
								{sources.map((scope) => (
									<SelectItem key={scope.id} value={scope.id}>
										{scope.name} - {scope.enabledPromptCount} enabled
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Prompt copies are independent records in the new scope; the source is not changed.
						</p>
					</div>
				</div>

				{error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
				{success && (
					<Alert>
						<CheckCircle2 />
						<AlertTitle>{labels.successTitle}</AlertTitle>
						<AlertDescription>{success}</AlertDescription>
					</Alert>
				)}

				<DialogFooter>
					{success ? (
						<Button onClick={() => setOpen(false)}>Done</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
								Cancel
							</Button>
							<Button onClick={handleSubmit} disabled={submitting}>
								{submitting && <Loader2 className="animate-spin" />}
								{labels.submit}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
