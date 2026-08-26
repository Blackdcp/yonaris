import { IconInfoCircle } from "@tabler/icons-react";
import { useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useI18n } from "@/i18n/provider";

export function DemoModePill() {
	const { t } = useI18n();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const isReadOnly = context.clientConfig?.features.readOnly ?? false;

	if (!isReadOnly) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					data-slot="deployment-status"
					className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
				>
					<IconInfoCircle className="size-3" />
					{t("navigation.demo")}
				</span>
			</TooltipTrigger>
			<TooltipContent>{t("navigation.demoReadOnly")}</TooltipContent>
		</Tooltip>
	);
}
