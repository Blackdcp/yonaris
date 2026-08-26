import * as Sentry from "@sentry/tanstackstart-react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { Skeleton } from "@workspace/ui/components/skeleton";
import FullPageCard from "./components/full-page-card";
import { useI18n } from "./i18n/provider";

export function NotFound() {
	const { t } = useI18n();
	return (
		<FullPageCard title={t("error.notFound.title")} subtitle={t("error.notFound.subtitle")} showBackButton={true} />
	);
}

export function DefaultPendingComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
			<div className="space-y-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-5 w-80" />
			</div>
			<div className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-64 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		</div>
	);
}

export function DefaultErrorComponent({ error }: ErrorComponentProps) {
	const { t } = useI18n();
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<FullPageCard title={t("error.unexpected.title")} subtitle={t("error.unexpected.subtitle")} showBackButton={true} />
	);
}
