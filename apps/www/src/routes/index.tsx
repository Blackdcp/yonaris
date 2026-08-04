import { createFileRoute } from "@tanstack/react-router";
import { CTA } from "@/components/cta";
import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { Stats } from "@/components/stats";
import { HOME_FAQS } from "@/lib/faqs";
import { canonicalUrl, faqJsonLd, ogMeta, SITE_DESCRIPTION, SITE_NAME, softwareApplicationJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: `${SITE_NAME} · AI Visibility & GEO` },
			{ name: "description", content: SITE_DESCRIPTION },
			...ogMeta({
				title: `${SITE_NAME} · AI Visibility & GEO`,
				description: SITE_DESCRIPTION,
				path: "/",
			}),
		],
		links: [{ rel: "canonical", href: canonicalUrl("/") }],
		scripts: [softwareApplicationJsonLd(), faqJsonLd(HOME_FAQS)],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<div className="min-h-screen">
			<Navbar />
			<main>
				<Hero />
				<Stats />
				<Features />
				<Faq items={HOME_FAQS} eyebrow="/ FAQ" />
				<CTA />
			</main>
			<Footer />
		</div>
	);
}
