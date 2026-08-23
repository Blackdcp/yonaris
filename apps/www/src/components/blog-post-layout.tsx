// Mirrors docs-page-layout.tsx: the heavy fumadocs-ui / browser-collection
// imports live here, NOT in the route file. routes/blog/$.tsx only
// references BlogPostLayout from inside the route's `component:`, which
// @tanstack/router-plugin auto-splits into its own chunk, keeping these deps
// out of the bundle that loads on other marketing pages.

import browserCollections from "collections/browser";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { ArrowLeft } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { Suspense } from "react";
import { AuthorByline } from "@/components/author-byline";
import { getMDXComponents } from "@/components/mdx";
import { PublicationShell } from "@/components/site/publication-shell";
import type { BlogPostFaqItem, BlogPostLoaderData } from "@/routes/blog/$";

function isInternalHref(href: string): boolean {
	if (href.startsWith("/") || href.startsWith("#")) return true;
	try {
		const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
		return configuredSiteUrl ? new URL(href).origin === new URL(configuredSiteUrl).origin : false;
	} catch {
		// mailto:, tel:, or other non-http(s) hrefs — not an outbound web link.
		return true;
	}
}

// Outbound hosts we intentionally pass SEO equity to (dofollow), e.g. partners
// we've agreed to link to. An explicit allowlist keeps the default nofollow.
const DOFOLLOW_HOSTS = ["semrush.com"];

function isDofollowHref(href: string): boolean {
	try {
		const { hostname } = new URL(href);
		return DOFOLLOW_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
	} catch {
		return false;
	}
}

// Links inside post content: outbound links are nofollow and open in a new
// tab, so blog posts don't pass SEO equity to external sites (e.g. competitors
// we reference). Internal links stay followed; noopener keeps the referrer for
// analytics on the configured site origin. Hosts in DOFOLLOW_HOSTS are the
// exception — followed outbound links for agreed partners.
function BlogLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
	if (isInternalHref(href)) {
		const rel = /^https?:\/\//.test(href) ? "noopener" : undefined;
		return <a {...props} href={href} rel={rel} />;
	}
	const rel = isDofollowHref(href) ? "noopener noreferrer" : "nofollow noopener noreferrer";
	return <a {...props} href={href} target="_blank" rel={rel} />;
}

// getMDXComponents is a plain factory (no React hooks), so the components map
// is built once at module scope rather than per render.
const mdxComponents = getMDXComponents({ a: BlogLink });

export const clientLoader = browserCollections.blog.createClientLoader({
	component({ default: MDX }, _props: undefined) {
		return <MDX components={mdxComponents} />;
	},
});

// Rendered from frontmatter `faq` as visible editorial content. Rich search
// markup remains withheld until the publication archive is reviewed.
function PostFaq({ items }: { items: BlogPostFaqItem[] }) {
	return (
		<section className="mt-14">
			<h2 id="faq">Frequently asked questions</h2>
			{items.map((item) => (
				<div key={item.question}>
					<h3>{item.question}</h3>
					<p>{item.answer}</p>
				</div>
			))}
		</section>
	);
}

export function BlogPostLayout({ data }: { data: BlogPostLoaderData }) {
	return (
		<RootProvider theme={{ defaultTheme: "light", forcedTheme: "light" }} search={{ enabled: false }}>
			<PublicationShell section="blog">
				<article className="publication-article">
					<a href="/blog" className="publication-back-link">
						<ArrowLeft className="size-3" />
						Publication notes
					</a>
					<header className="publication-article__header">
						<p className="publication-kicker">Field note</p>
						<h1 className="publication-article__title">{data.title}</h1>
						{data.description && <p className="publication-article__lead">{data.description}</p>}
						<div className="publication-article__byline">
							<AuthorByline author={data.author} date={data.date} updated={data.updated} />
						</div>
					</header>
					<div className="publication-article__body prose">
						<Suspense>{clientLoader.useContent(data.path)}</Suspense>
						{data.faq && data.faq.length > 0 && <PostFaq items={data.faq} />}
					</div>
				</article>
			</PublicationShell>
		</RootProvider>
	);
}
