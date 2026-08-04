import { createFileRoute } from "@tanstack/react-router";
import { CTA } from "@/components/cta";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PRICING_FAQS } from "@/lib/faqs";
import { breadcrumbJsonLd, canonicalUrl, faqJsonLd, ogMeta } from "@/lib/seo";

const title = "Pricing and Deployment Options · Yonaris";
const description = "Explore self-hosted, managed, and white-label deployment options for Yonaris.";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{ title },
			{ name: "description", content: description },
			...ogMeta({ title, description, path: "/pricing" }),
		],
		links: [{ rel: "canonical", href: canonicalUrl("/pricing") }],
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Pricing", path: "/pricing" },
			]),
			faqJsonLd(PRICING_FAQS),
		],
	}),
	component: PricingPage,
});

function PricingPage() {
	return (
		<div className="min-h-screen">
			<Navbar />
			<main>
				<section className="border-b border-zinc-200 bg-white px-4 py-20 md:px-6 md:py-28">
					<div className="mx-auto max-w-3xl text-center">
						<p className="font-mono text-xs font-medium tracking-[0.2em] text-blue-600 uppercase">/ Pricing</p>
						<h1 className="mt-4 text-balance font-semibold text-4xl tracking-tight text-zinc-950 md:text-6xl">
							Pricing and deployment options
						</h1>
						<p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-zinc-600 leading-relaxed">
							Yonaris can be configured for different delivery, data-control, and infrastructure requirements. Scope,
							availability, and commercial terms are confirmed for each deployment.
						</p>
					</div>
				</section>
				<Faq items={PRICING_FAQS} eyebrow="/ FAQ" />
				<CTA />
			</main>
			<Footer />
		</div>
	);
}
