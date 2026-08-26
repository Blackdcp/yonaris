import { Button } from "@workspace/ui/components/button";
import { Download } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { ChartFooter } from "./chart-footer";

interface ChartDownloadFooterProps {
	onDownload: () => void;
	isDownloading: boolean;
}

export function ChartDownloadFooter({ onDownload, isDownloading }: ChartDownloadFooterProps) {
	const { t } = useI18n();
	return (
		<div className="print:hidden">
			<ChartFooter>
				<Button
					onClick={onDownload}
					disabled={isDownloading}
					size="sm"
					variant="secondary"
					className="text-xs cursor-pointer h-6 flex items-center px-2"
					title={t("chart.downloadPng")}
				>
					<Download className="size-3 mr-0.5" />
					<span className="text-xs font-normal">{isDownloading ? t("chart.exporting") : t("chart.exportPng")}</span>
				</Button>
			</ChartFooter>
		</div>
	);
}
