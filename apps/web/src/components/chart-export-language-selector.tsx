import { isContentLanguage, type OutputLanguage } from "@workspace/config/language";
import { useI18n } from "@/i18n/provider";

export interface ChartExportLanguageSelectorProps {
	id: string;
	outputLanguage: OutputLanguage;
	isResolved: boolean;
	onOutputLanguageChange: (outputLanguage: OutputLanguage) => void;
}

export function ChartExportLanguageSelector({
	id,
	outputLanguage,
	isResolved,
	onOutputLanguageChange,
}: ChartExportLanguageSelectorProps) {
	const { t } = useI18n();

	return (
		<label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<span>{t("chart.outputLanguage")}</span>
			<select
				id={id}
				data-slot="chart-export-output-language"
				className="h-6 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
				value={outputLanguage}
				disabled={!isResolved}
				onChange={(event) => {
					if (isContentLanguage(event.target.value)) onOutputLanguageChange(event.target.value);
				}}
			>
				<option value="en">{t("chart.outputLanguage.en")}</option>
				<option value="zh-CN">{t("chart.outputLanguage.zhCn")}</option>
			</select>
		</label>
	);
}
