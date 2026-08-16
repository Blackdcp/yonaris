import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { BrowserRunnerDeviceList } from "@/components/sampling/browser-runner-device-list";
import type { BrowserRunnerDeviceView, SamplingContextView } from "@/components/sampling/types";
import { getAppName } from "@/lib/route-head";
import {
	createBrowserRunnerPairingFn,
	listBrowserRunnerDevicesFn,
	revokeBrowserRunnerDeviceFn,
} from "@/server/browser-runner-devices";
import { getSamplingContextFn } from "@/server/sampling";

export const Route = createFileRoute("/_authed/admin/sampling/devices")({
	head: ({ match }) => {
		const appName = getAppName(match);
		return {
			meta: [
				{ title: `Local Browser devices · ${appName}` },
				{ name: "description", content: "Pair and manage local Chrome Browser Runner devices." },
			],
		};
	},
	component: BrowserRunnerDevicesPage,
});

function BrowserRunnerDevicesPage() {
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
					<h1 className="text-3xl font-bold tracking-tight">Local Browser devices</h1>
					<p className="mt-1 text-muted-foreground">
						Pair administrator-operated Chrome devices that collect Doubao and DeepSeek tasks.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/admin/sampling">
						<ArrowLeft /> Sampling operations
					</Link>
				</Button>
			</div>

			{contextQuery.isError || devicesQuery.isError ? (
				<Alert variant="destructive">
					<TriangleAlert />
					<AlertTitle>Could not load local devices</AlertTitle>
					<AlertDescription>{String(contextQuery.error ?? devicesQuery.error)}</AlertDescription>
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
