// All fumadocs-ui / docs UI imports live here, NOT in routes/docs/$.tsx.
// $.tsx and index.tsx only reference DocsPageLayout from inside the route's
// `component:`, which @tanstack/router-plugin auto-splits into its own chunk.
// The static imports below get hoisted into that chunk, so the heavy
// fumadocs-ui + shiki + orama deps stay out of the main bundle that loads
// on the marketing pages.

import { DocsSidebar } from "@workspace/docs/components/docs-sidebar";
import { DocsToc } from "@workspace/docs/components/docs-toc";
import { Feedback } from "@workspace/docs/components/feedback/client";
import type { ActionResponse, PageFeedback } from "@workspace/docs/components/feedback/schema";
import browserCollections from "collections/browser";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import type { ClientApiPageProps } from "fumadocs-openapi/ui/create-client";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { Suspense } from "react";
import { ClientAPIPage } from "@/components/api-page";
import { useMDXComponents } from "@/components/mdx";
import { UtilityShell } from "@/components/site/utility-shell";
import { DOCS_IDENTITY_DISCLOSURE } from "@/lib/docs-context";
import type { LoaderData } from "@/routes/docs/$";

// /docs/foo → /docs/foo.md  (/docs index → /docs.md). The same markdown the
// .md/.mdx routes and the Accept-header negotiation serve (see server.ts).
function docsMarkdownPath(slugs: string[]): string {
	return slugs.length ? `/docs/${slugs.join("/")}.md` : "/docs.md";
}

async function onFeedback(feedback: PageFeedback): Promise<ActionResponse> {
	const { trackEvent } = await import("@/lib/posthog");
	trackEvent("docs_page_feedback", {
		opinion: feedback.opinion,
		message: feedback.message || undefined,
		url: feedback.url,
	});
	return { success: true };
}

export const clientLoader = browserCollections.docs.createClientLoader({
	component({ toc, frontmatter, default: MDX }, _props: undefined) {
		function MarkdownPage() {
			const mdxComponents = useMDXComponents();

			return (
				<div className="utility-docs-embedded">
					<article className="prose min-w-0 max-w-none flex-1">
						<h1>{frontmatter.title}</h1>
						{frontmatter.description && <p className="lead text-muted-foreground">{frontmatter.description}</p>}
						<MDX components={mdxComponents} />
						<div className="not-prose">
							<Feedback onSendAction={onFeedback} />
						</div>
					</article>

					{toc.length > 0 && (
						<aside className="utility-docs-toc">
							<div className="sticky top-20">
								<DocsToc toc={toc} />
							</div>
						</aside>
					)}
				</div>
			);
		}

		return <MarkdownPage />;
	},
});

function DocsPageActions({ mdUrl }: { mdUrl: string }) {
	return (
		<div className="utility-docs-actions">
			<a href={mdUrl} target="_blank" rel="noopener" className="utility-action">
				<svg
					aria-hidden="true"
					className="size-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
					<path d="M14 2v5h5" />
					<path d="M9 13h6" />
					<path d="M9 17h6" />
				</svg>
				View as Markdown
			</a>
		</div>
	);
}

function OpenApiContent({
	title,
	description,
	apiProps,
}: {
	title: string;
	description: string;
	apiProps: ClientApiPageProps;
}) {
	return (
		<article className="prose min-w-0 max-w-none flex-1">
			<h1>{title}</h1>
			{description && <p className="lead text-muted-foreground">{description}</p>}
			<div className="not-prose">
				<ClientAPIPage {...apiProps} />
			</div>
		</article>
	);
}

function MarkdownContent({ path, slugs }: { path: string; slugs: string[] }) {
	const content = clientLoader.useContent(path);

	return (
		<>
			<Suspense>{content}</Suspense>
			<DocsPageActions mdUrl={docsMarkdownPath(slugs)} />
		</>
	);
}

export function DocsPageLayout({ loaderData }: { loaderData: LoaderData }) {
	const data = useFumadocsLoader(loaderData);

	return (
		<RootProvider theme={{ defaultTheme: "light", forcedTheme: "light" }} search={{ enabled: false }}>
			<UtilityShell section="docs">
				<p className="utility-docs-context">{DOCS_IDENTITY_DISCLOSURE}</p>
				<details className="utility-docs-mobile-nav">
					<summary>Browse and search documentation</summary>
					<div>
						<DocsSidebar tree={data.pageTree} />
					</div>
				</details>
				<div className="utility-docs-layout">
					<aside className="utility-docs-sidebar" aria-label="Documentation navigation">
						<div>
							<DocsSidebar tree={data.pageTree} />
						</div>
					</aside>
					<div className="utility-docs-content">
						{data.type === "openapi" ? (
							<OpenApiContent title={data.title} description={data.description} apiProps={data.apiProps} />
						) : (
							<MarkdownContent path={data.path} slugs={data.slugs} />
						)}
					</div>
				</div>
			</UtilityShell>
		</RootProvider>
	);
}
