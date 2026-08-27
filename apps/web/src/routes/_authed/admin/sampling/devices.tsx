import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import { BrowserRunnerDeviceList } from "@/components/sampling/browser-runner-device-list";
import { BrowserRunnerExtensionInstall } from "@/components/sampling/browser-runner-extension-install";
import type { BrowserRunnerDeviceView, SamplingContextView } from "@/components/sampling/types";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
import {
	createBrowserRunnerPairingFn,
	listBrowserRunnerDevicesFn,
	revokeBrowserRunnerDeviceFn,
} from "@/server/browser-runner-devices";
import { getSamplingContextFn } from "@/server/sampling";

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

export const Route = createFileRoute("/_authed/admin/sampling/devices")({
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "sampling.devices.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "sampling.devices.head.description") },
			],
		};
	},
	component: BrowserRunnerDevicesPage,
});

function BrowserRunnerDevicesPage() {
	const { t } = useI18n();
	const contextQuery = useQuery({
		queryKey: ["admin", "sampling", "context", "device-management"],
		queryFn: () => getSamplingContextFn({ data: {} }),
		staleTime: 30_000,
	});
	const devicesQuery = useQuery({
		queryKey: ["admin", "sampling", "browser-runner-devices"],
		queryFn: () => listBrowserRunnerDevicesFn(),
		refetchInterval: 60_000,
	});
	const context = contextQuery.data as SamplingContextView | undefined;
	const devices = (devicesQuery.data ?? []) as BrowserRunnerDeviceView[];

	const createPairing = async (input: { brandId: string; displayName: string }) => {
		const result = await createBrowserRunnerPairingFn({ data: input });
		return { code: result.code, expiresAt: result.expiresAt };
	};

	const revoke = async (deviceId: string) => {
		await revokeBrowserRunnerDeviceFn({ data: { deviceId } });
		await devicesQuery.refetch();
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{t("sampling.devices.title")}</h1>
					<p className="mt-1 text-muted-foreground">{t("sampling.devices.description")}</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/admin/sampling">
						<ArrowLeft /> {t("sampling.devices.back")}
					</Link>
				</Button>
			</div>
			<BrowserRunnerExtensionInstall />

			{contextQuery.isLoading || devicesQuery.isLoading ? (
				<p className="text-sm text-muted-foreground">{t("sampling.devices.loading")}</p>
			) : contextQuery.isError || devicesQuery.isError ? (
				<Alert variant="destructive">
					<TriangleAlert />
					<AlertTitle>{t("sampling.devices.error")}</AlertTitle>
					<AlertDescription>
						<LocalizedRawDetail
							labelId="sampling.raw.errorDetails"
							detail={rawErrorDetail(contextQuery.error ?? devicesQuery.error) ?? ""}
						/>
					</AlertDescription>
				</Alert>
			) : (
				<BrowserRunnerDeviceList
					brands={context?.brands ?? []}
					devices={devices}
					onCreatePairing={createPairing}
					onRevoke={revoke}
				/>
			)}
		</div>
	);
}
