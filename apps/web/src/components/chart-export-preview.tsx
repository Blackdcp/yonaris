import { DEFAULT_APP_ICON, DEFAULT_APP_NAME, DEFAULT_APP_WORDMARK, YONARIS_COLORS } from "@workspace/config/constants";
import type { OutputLanguage } from "@workspace/config/language";
import type { Brand, Competitor } from "@workspace/lib/db/schema";
import { Badge } from "@workspace/ui/components/badge";
import { getReportCopy } from "@/i18n/report-copy";
import type { ChartDataPoint, LookbackPeriod } from "@/lib/chart-utils";
import { getBadgeClassName, getBadgeVariant } from "@/lib/chart-utils";
import { BaseChart } from "./base-chart";

export interface ChartExportBranding {
	name?: string;
	icon?: string;
	wordmark?: string;
	url?: string;
	parentUrl?: string;
	isWhitelabel: boolean;
	chartColors: string[];
}

export interface ChartExportPreviewProps {
	outputLanguage: OutputLanguage;
	promptName: string;
	visibility: number | null;
	data: ChartDataPoint[];
	lookback: LookbackPeriod;
	brand: Brand;
	competitors: Competitor[];
	branding: ChartExportBranding;
}

export const EXPORT_W = 1200;
export const EXPORT_H = 628;

const HEADER_H = 56;
const HEADER_TOP = 16;
const GAP_HEADER_CARD = 16;
const CARD_PADDING_Y = 24;
const FOOTER_REGION = 80;
const CHART_H = EXPORT_H - HEADER_TOP - HEADER_H - GAP_HEADER_CARD - CARD_PADDING_Y - FOOTER_REGION;

function formatBrandDomain(url?: string): string {
	const value = url?.trim();
	if (!value) return "";

	try {
		const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
		const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
		if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "";
		return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}`;
	} catch {
		const normalized = value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
		if (/^(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?(?:\/|$)/i.test(normalized)) return "";
		return normalized;
	}
}

export function ChartExportPreview({
	outputLanguage,
	promptName,
	visibility,
	data,
	lookback,
	brand,
	competitors,
	branding,
}: ChartExportPreviewProps) {
	const copy = getReportCopy(outputLanguage);
	const name = branding.name || DEFAULT_APP_NAME;
	const domain = formatBrandDomain(branding.parentUrl || branding.url);
	const usesDefaultBrand = name === DEFAULT_APP_NAME && (!branding.icon || branding.icon === DEFAULT_APP_ICON);
	const wordmark = branding.wordmark || (usesDefaultBrand ? DEFAULT_APP_WORDMARK : undefined);
	const hasCustomIcon = branding.icon && branding.icon !== DEFAULT_APP_ICON;

	return (
		<div
			lang={outputLanguage}
			style={{
				width: EXPORT_W,
				height: EXPORT_H,
				paddingTop: HEADER_TOP,
				fontSize: 16,
				backgroundColor: branding.isWhitelabel ? "#ffffff" : YONARIS_COLORS.paper,
			}}
			className="overflow-hidden flex flex-col"
		>
			{/* Title bar */}
			<div
				style={{ height: HEADER_H, marginBottom: GAP_HEADER_CARD }}
				className="flex items-center justify-between px-10 gap-6 shrink-0"
			>
				<h2
					className="font-semibold truncate flex-1 min-w-0"
					style={{ fontSize: 22, color: branding.isWhitelabel ? "#111827" : YONARIS_COLORS.ink }}
					title={promptName}
				>
					{promptName}
				</h2>
				{visibility !== null && (
					<Badge
						variant={getBadgeVariant(visibility)}
						className={`${getBadgeClassName(visibility)} shrink-0`}
						style={{ fontSize: 16, padding: "4px 14px" }}
					>
						{copy.formatPercent(visibility)} {copy.chart.visibility}
					</Badge>
				)}
			</div>

			{/* Chart card */}
			<div className="px-8 shrink-0">
				<div
					className="rounded-xl border overflow-hidden pl-0"
					style={{
						paddingRight: 12,
						paddingTop: 12,
						paddingBottom: 8,
						borderColor: branding.isWhitelabel ? "#e5e7eb" : YONARIS_COLORS.mist,
					}}
				>
					<BaseChart
						outputLanguage={outputLanguage}
						data={data}
						lookback={lookback}
						brand={brand}
						competitors={competitors}
						isAnimationActive={false}
						chartType="line"
						chartColors={branding.chartColors}
						chartHeight={`${CHART_H}px`}
					/>
				</div>
			</div>

			{/* Branding footer — fills remaining space, content vertically centered */}
			<div className="flex-1 flex items-center justify-between px-10 min-h-0">
				<div className="flex items-center gap-3">
					{wordmark ? (
						<img
							src={wordmark}
							alt={copy.chart.logoAlt(name)}
							style={{ width: 148, height: 36 }}
							className="object-contain"
							crossOrigin="anonymous"
						/>
					) : (
						<>
							{hasCustomIcon && (
								<img
									src={branding.icon}
									alt={copy.chart.logoAlt(name)}
									style={{ width: 28, height: 28 }}
									className="object-contain"
									crossOrigin="anonymous"
								/>
							)}
							<span style={{ fontSize: 18 }} className="text-gray-500 font-semibold">
								{name}
							</span>
						</>
					)}
				</div>
				{domain && (
					<span style={{ fontSize: 18 }} className="text-gray-400 font-medium">
						{domain}
					</span>
				)}
			</div>
		</div>
	);
}
