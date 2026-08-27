import { useState } from "react";

export function useChartExport(_fileName: string, _outputLanguage: "en" | "zh-CN") {
	const [isExporting] = useState(false);

	const handleExport = async () => {
		console.log("[mock] useChartExport: export skipped in Storybook");
	};

	return { isExporting, handleExport, portal: null };
}
