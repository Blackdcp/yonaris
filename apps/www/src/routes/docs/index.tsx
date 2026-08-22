import { createFileRoute } from "@tanstack/react-router";
import { DocsPageLayout } from "@/components/docs-page-layout";
import { DOCS_IDENTITY_DISCLOSURE } from "@/lib/docs-context";
import { getPageImage } from "@/lib/og";
import { breadcrumbJsonLd, SITE_NAME } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";
import { type LoaderData, serverLoader } from "./$";

export const Route = createFileRoute("/docs/")({
	component: Page,
	head: ({ loaderData }) => {
		const data = loaderData as LoaderData | undefined;
		if (!data) return {};

		const pageTitle = `Documentation · ${SITE_NAME}`;
		const image = getPageImage([]).url;
		const head = siteRouteHead("docs", {
			canonicalPath: "/docs",
			title: pageTitle,
			description: DOCS_IDENTITY_DISCLOSURE,
			image,
			type: "article",
		});

		return {
			...head,
			scripts: [
				breadcrumbJsonLd([
					{ name: "Home", path: "/" },
					{ name: "Docs", path: "/docs" },
				]),
			],
		};
	},
	loader: async () => serverLoader({ data: [] }),
});

function Page() {
	const loaderData = Route.useLoaderData() as LoaderData;
	return <DocsPageLayout loaderData={loaderData} />;
}
