import { createFileRoute, redirect } from "@tanstack/react-router";
import { translate } from "@/i18n/catalog";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/$brand/prompts/")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "prompt.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "prompt.meta.description") },
			],
		};
	},
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/app/$brand/visibility",
			params: { brand: params.brand },
		});
	},
});
