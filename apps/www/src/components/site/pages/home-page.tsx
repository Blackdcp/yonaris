import { getGlobalContent, getHomeComposition } from "@/content/site/global";
import type { Locale } from "@/content/site/types";
import { SiteShell } from "../site-shell";
import { HomeHero } from "./home-hero";
import { HomeNarrative } from "./home-narrative";

export function HomePage({ locale }: { locale: Locale }): React.ReactNode {
	const global = getGlobalContent(locale);
	const composition = getHomeComposition(locale);

	return (
		<SiteShell locale={locale} activeKey="home" mainClassName="home-page">
			<HomeHero locale={locale} content={global} />
			<HomeNarrative locale={locale} global={global} composition={composition} />
		</SiteShell>
	);
}
