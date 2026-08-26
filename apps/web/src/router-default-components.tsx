import * as Sentry from "@sentry/tanstackstart-react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { isContentLanguage, type UiLanguage } from "@workspace/config/language";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useEffect } from "react";
import FullPageCard from "./components/full-page-card";
import { translate } from "./i18n/catalog";
import { useI18n, useOptionalI18n } from "./i18n/provider";

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

function errorFallbackLanguage(error: unknown): UiLanguage {
	const errorLanguage = (error as { uiLanguage?: unknown } | null)?.uiLanguage;
	if (isContentLanguage(errorLanguage)) return errorLanguage;

	if (typeof document !== "undefined" && isContentLanguage(document.documentElement.lang)) {
		return document.documentElement.lang;
	}

	return "en";
}

export function DefaultErrorComponent({ error }: ErrorComponentProps) {
	const i18n = useOptionalI18n();
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	if (!i18n) {
		const locale = errorFallbackLanguage(error);
		return (
			<main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
				<div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
					<h1 className="text-xl font-semibold">{translate(locale, "error.unexpected.title")}</h1>
					<p className="mt-1 text-sm text-muted-foreground">{translate(locale, "error.unexpected.subtitle")}</p>
				</div>
			</main>
		);
	}

	return (
		<FullPageCard
			title={i18n.t("error.unexpected.title")}
			subtitle={i18n.t("error.unexpected.subtitle")}
			showBackButton={true}
		/>
	);
}
