import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { CustomerProgramsView } from "@/components/customer-programs-view";
import type { ProvisionSamplingScopeInput } from "@/components/sampling/types";
import { translate } from "@/i18n/catalog";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { getCustomerProgramContextFn, provisionCustomerProgramScopeFn } from "@/server/customer-programs";

export const Route = createFileRoute("/_authed/app/$brand/programs")({
	loader: async ({ params }) => getCustomerProgramContextFn({ data: { brandId: params.brand } }),
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "program.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "program.meta.description") },
			],
		};
	},
	pendingComponent: ProgramsSkeleton,
	component: ProgramsPage,
});

function ProgramsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-9 w-52" />
				<Skeleton className="h-5 w-full max-w-xl" />
			</div>
			<Skeleton className="h-20 w-full" />
			<Skeleton className="h-72 w-full" />
		</div>
	);
}

function ProgramsPage() {
	const context = Route.useLoaderData();
	const router = useRouter();

	const provisionProgram = async (input: ProvisionSamplingScopeInput) => {
		const result = await provisionCustomerProgramScopeFn({ data: input });
		await router.invalidate();
		return { copiedPromptCount: result.copiedPromptCount };
	};

	return <CustomerProgramsView context={context} onProvision={provisionProgram} />;
}
