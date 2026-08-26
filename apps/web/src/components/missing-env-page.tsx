import type { DeploymentMode } from "@workspace/config/types";
import type { MissingEnvVar } from "@workspace/config/env";
import FullPageCard from "@/components/full-page-card";
import { useI18n } from "@/i18n/provider";

interface MissingEnvPageProps {
	mode: DeploymentMode;
	missing: MissingEnvVar[];
}

export default function MissingEnvPage({ mode, missing }: MissingEnvPageProps) {
	const { t } = useI18n();
	const sortedMissing = [...missing].sort((a, b) => a.label.localeCompare(b.label));

	const localHint = mode === "local" ? t("error.missingEnv.localHint") : t("error.missingEnv.deploymentHint");

	return (
		<FullPageCard
			title={t("error.missingEnv.title")}
			subtitle={t("error.missingEnv.mode", { mode })}
			className="max-w-2xl"
		>
			<div className="space-y-4 text-sm">
				<p>{localHint}</p>
				<ul className="space-y-3 rounded-md border bg-background p-4">
					{sortedMissing.map((item) => (
						<li key={item.id} className="flex flex-col gap-1">
							<span className="font-mono text-xs text-foreground">{item.label}</span>
							{item.description ? <span className="text-muted-foreground">{item.description}</span> : null}
						</li>
					))}
				</ul>
			</div>
		</FullPageCard>
	);
}
