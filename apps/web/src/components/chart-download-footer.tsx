import type { OutputLanguage } from "@workspace/config/language";
import { Button } from "@workspace/ui/components/button";
import { Download } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { getReportCopy } from "@/i18n/report-copy";
import { ChartFooter } from "./chart-footer";

interface ChartDownloadFooterProps {
	outputLanguage?: OutputLanguage;
	onDownload: () => void;
	isDownloading: boolean;
}

export function ChartDownloadFooter({ outputLanguage, onDownload, isDownloading }: ChartDownloadFooterProps) {
	const { t } = useI18n();
	const reportCopy = outputLanguage ? getReportCopy(outputLanguage) : null;
	return (
		<div className="print:hidden">
			<ChartFooter>
				<Button
					onClick={onDownload}
					disabled={isDownloading}
					size="sm"
					variant="secondary"
					className="text-xs cursor-pointer h-6 flex items-center px-2"
					title={reportCopy?.chart.downloadPng ?? t("chart.downloadPng")}
				>
					<Download className="size-3 mr-0.5" />
					<span className="text-xs font-normal">
						{isDownloading
							? (reportCopy?.chart.exporting ?? t("chart.exporting"))
							: (reportCopy?.chart.exportPng ?? t("chart.exportPng"))}
					</span>
				</Button>
			</ChartFooter>
		</div>
	);
}
