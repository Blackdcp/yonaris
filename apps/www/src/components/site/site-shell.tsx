import type { ReactNode } from "react";
import type { CorePageKey, Locale } from "@/content/site/types";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface SiteShellProps {
	locale: Locale;
	activeKey?: CorePageKey;
	children: ReactNode;
	mainClassName?: string;
}

export function SiteShell({ locale, activeKey, children, mainClassName }: SiteShellProps): React.ReactNode {
	return (
		<div
			className="site-shell marketing-site min-h-[100svh] bg-[var(--yonaris-paper)] text-[var(--yonaris-ink)]"
			lang={locale === "zh" ? "zh-CN" : "en"}
		>
			<SiteHeader locale={locale} activeKey={activeKey} />
			<main className={mainClassName}>{children}</main>
			<SiteFooter locale={locale} />
		</div>
	);
}
