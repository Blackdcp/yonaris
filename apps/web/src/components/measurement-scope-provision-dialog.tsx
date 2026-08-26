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
import { useI18n } from "@/i18n/provider";

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
	const { t, formatNumber } = useI18n();
	const defaultCopy: MeasurementScopeProvisionDialogCopy = {
		trigger: t("program.provision.trigger"),
		title: t("program.provision.title"),
		description: t("program.provision.description"),
		submit: t("program.provision.submit"),
		successTitle: t("program.provision.ready"),
	};
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
			setError(t("program.provision.keyError"));
			return;
		}
		if (!name.trim()) {
			setError(t("program.provision.nameError"));
			return;
		}
		if (!/^[A-Z]{2}$/.test(normalizedMarket) || normalizedMarket === "ZZ") {
			setError(t("program.provision.marketError"));
			return;
		}
		if (!isValidLocale(normalizedLocale)) {
			setError(t("program.provision.localeError"));
			return;
		}
		if (!isValidTimezone(normalizedTimezone)) {
			setError(t("program.provision.timezoneError"));
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
				t(result.copiedPromptCount === 1 ? "program.provision.success.one" : "program.provision.success.many", {
					count: formatNumber(result.copiedPromptCount),
				}),
			);
		} catch {
			setError(t("program.provision.error"));
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
						<Label htmlFor="measurement-scope-key">{t("program.provision.key")}</Label>
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
						<Label htmlFor="measurement-scope-name">{t("program.provision.name")}</Label>
						<Input
							id="measurement-scope-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("program.provision.namePlaceholder")}
							maxLength={120}
							disabled={submitting || Boolean(success)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-market">{t("program.provision.market")}</Label>
						<Input
							id="measurement-scope-market"
							value={market}
							onChange={(event) => setMarket(event.target.value.toUpperCase())}
							placeholder="CN"
							maxLength={2}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">{t("program.provision.marketHint")}</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="measurement-scope-locale">{t("program.provision.locale")}</Label>
						<Input
							id="measurement-scope-locale"
							value={locale}
							onChange={(event) => setLocale(event.target.value)}
							placeholder="zh-CN"
							maxLength={35}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">{t("program.provision.localeHint")}</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label>{t("program.provision.pool")}</Label>
						<Select
							value={evaluationRole}
							onValueChange={(value: SamplingEvaluationRole) => setEvaluationRole(value)}
							disabled={submitting || Boolean(success)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="scored">{t("program.provision.scored")}</SelectItem>
								<SelectItem value="observation">{t("program.provision.observation")}</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">{t("program.provision.poolHint")}</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="measurement-scope-timezone">{t("program.provision.timezone")}</Label>
						<Input
							id="measurement-scope-timezone"
							value={timezone}
							onChange={(event) => setTimezone(event.target.value)}
							placeholder="Asia/Shanghai"
							maxLength={100}
							disabled={submitting || Boolean(success)}
						/>
						<p className="text-xs text-muted-foreground">{t("program.provision.timezoneHint")}</p>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label>{t("program.provision.copyFrom")}</Label>
						<Select value={sourceScopeId} onValueChange={setSourceScopeId} disabled={submitting || Boolean(success)}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">{t("program.provision.noCopy")}</SelectItem>
								{sources.map((scope) => (
									<SelectItem key={scope.id} value={scope.id}>
										{t("program.provision.sourceOption", {
											name: scope.name,
											count: formatNumber(scope.enabledPromptCount),
										})}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">{t("program.provision.copyHint")}</p>
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
						<Button onClick={() => setOpen(false)}>{t("program.provision.done")}</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
								{t("program.provision.cancel")}
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
