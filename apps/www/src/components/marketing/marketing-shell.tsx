import type { ReactNode } from "react";
import type { CorePageKey } from "@/content/site/types";
import type { Locale, MarketingPageKey } from "@/lib/marketing-content";
import { SiteShell } from "../site/site-shell";

interface MarketingShellProps {
	locale: Locale;
	page?: MarketingPageKey;
	children: ReactNode;
}

const canonicalPageKey = {
	home: "home",
	platform: "product",
	methodology: "approach",
	results: "research",
	geo: "geo",
	diagnostic: "diagnostic",
} as const satisfies Record<MarketingPageKey, CorePageKey>;

export function MarketingShell({ locale, page = "home", children }: MarketingShellProps) {
	return (
		<SiteShell locale={locale} activeKey={canonicalPageKey[page]}>
			{children}
		</SiteShell>
	);
}
