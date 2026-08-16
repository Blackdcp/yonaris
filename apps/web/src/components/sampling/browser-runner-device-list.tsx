import type {
	BrowserExtensionReadinessStatus,
	BrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Copy, KeyRound, Laptop, Loader2, ShieldX } from "lucide-react";
import { useState } from "react";
import { browserRunnerDeviceIsOnline } from "./sampling-run-now-dialog";
import type { BrowserRunnerDeviceView, BrowserRunnerPairingView, SamplingBrandOption } from "./types";

const SURFACE_LABELS: Record<BrowserExtensionSurface, string> = {
	"doubao.consumer_web": "Doubao",
	"deepseek.consumer_web": "DeepSeek",
};

export async function confirmBrowserRunnerDeviceRevocation(
	device: BrowserRunnerDeviceView,
	revoke: (deviceId: string) => Promise<void> | void,
	confirm: (message: string) => boolean = (message) => globalThis.confirm(message),
): Promise<void> {
	if (!confirm(`Revoke ${device.displayName}? It will stop receiving new tasks immediately.`)) return;
	await revoke(device.id);
}

export function BrowserRunnerDeviceList({
	brands,
	devices,
	onCreatePairing,
	onRevoke,
	now = new Date(),
	initialPairing,
}: {
	brands: SamplingBrandOption[];
	devices: BrowserRunnerDeviceView[];
	onCreatePairing: (input: {
		brandId: string;
		displayName: string;
	}) => Promise<{ code: string; expiresAt: string | Date }>;
	onRevoke: (deviceId: string) => Promise<void>;
	now?: Date;
	initialPairing?: BrowserRunnerPairingView;
}) {
	const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
	const [displayName, setDisplayName] = useState("");
	const [pairing, setPairing] = useState<BrowserRunnerPairingView | undefined>(initialPairing);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const createPairing = async () => {
		if (!brandId || !displayName.trim()) return;
		setBusy("pairing");
		setError(null);
		try {
			const created = await onCreatePairing({ brandId, displayName: displayName.trim() });
			setPairing({ code: created.code, expiresAt: new Date(created.expiresAt).toISOString() });
			setDisplayName("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create a pairing code.");
		} finally {
			setBusy(null);
		}
	};

	const revoke = async (device: BrowserRunnerDeviceView) => {
		await confirmBrowserRunnerDeviceRevocation(device, async (deviceId) => {
			setBusy(deviceId);
			setError(null);
			try {
				await onRevoke(deviceId);
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "Could not revoke this device.");
			} finally {
				setBusy(null);
			}
		});
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<KeyRound className="size-5" />
						Pair a local Chrome
					</CardTitle>
					<CardDescription>
						Create a 15-minute one-time code, then enter it in the Yonaris Browser Runner extension on Windows or macOS.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
						<div className="grid gap-2">
							<Label htmlFor="pair-device-name">Device name</Label>
							<Input
								id="pair-device-name"
								placeholder="e.g. Marketing MacBook"
								maxLength={100}
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="pair-device-brand">Customer</Label>
							<select
								id="pair-device-brand"
								className="h-9 rounded-md border bg-background px-3 text-sm"
								value={brandId}
								onChange={(event) => setBrandId(event.target.value)}
							>
								{brands.map((brand) => (
									<option key={brand.id} value={brand.id}>
										{brand.name}
									</option>
								))}
							</select>
						</div>
						<Button disabled={busy !== null || !brandId || !displayName.trim()} onClick={createPairing}>
							{busy === "pairing" && <Loader2 className="animate-spin" />}
							Create pairing code
						</Button>
					</div>

					{pairing && (
						<Alert>
							<KeyRound />
							<AlertTitle>Pairing code — shown only once</AlertTitle>
							<AlertDescription className="space-y-3">
								<code className="block select-all break-all rounded bg-muted p-3 text-base text-foreground">
									{pairing.code}
								</code>
								<div className="flex flex-wrap items-center gap-3">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => navigator.clipboard.writeText(pairing.code)}
									>
										<Copy /> Copy pairing code
									</Button>
									<span>Expires {formatBeijingTime(pairing.expiresAt)}</span>
								</div>
							</AlertDescription>
						</Alert>
					)}
					{error && <p className="text-sm text-destructive">{error}</p>}
				</CardContent>
			</Card>

			<div className="grid gap-4">
				{devices.length === 0 ? (
					<Card>
						<CardContent className="py-8 text-center text-muted-foreground">
							No local Chrome device has been paired yet.
						</CardContent>
					</Card>
				) : (
					devices.map((device) => {
						const online = browserRunnerDeviceIsOnline(device, now);
						const revoked = device.revokedAt !== null;
						return (
							<Card key={device.id}>
								<CardHeader className="flex flex-row items-start justify-between gap-4">
									<div>
										<CardTitle className="flex items-center gap-2 text-base">
											<Laptop className="size-4" /> {device.displayName}
										</CardTitle>
										<CardDescription>
											{device.platform === "windows" ? "Windows" : "macOS"} · Chrome {device.browserVersion} · extension{" "}
											{device.extensionVersion}
										</CardDescription>
									</div>
									<Badge variant={revoked ? "destructive" : online ? "default" : "outline"}>
										{revoked ? "Revoked" : online ? "Online" : "Offline"}
									</Badge>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid gap-2 sm:grid-cols-2">
										{device.supportedSurfaces.map((surface) => {
											const readiness = device.readiness[surface];
											return (
												<div key={surface} className="rounded-md border p-3">
													<p className="font-medium">{SURFACE_LABELS[surface]}</p>
													<p className="text-sm text-muted-foreground">
														{readiness
															? `${formatReadiness(readiness.status)} · ${readiness.activeConcurrency} active`
															: "No readiness report"}
													</p>
												</div>
											);
										})}
									</div>
									<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
										<span>Last heartbeat: {device.lastSeenAt ? formatBeijingTime(device.lastSeenAt) : "Never"}</span>
										{!revoked && (
											<Button variant="destructive" size="sm" disabled={busy !== null} onClick={() => revoke(device)}>
												<ShieldX /> Revoke
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						);
					})
				)}
			</div>
		</div>
	);
}

function formatReadiness(status: BrowserExtensionReadinessStatus): string {
	switch (status) {
		case "ready":
			return "Ready";
		case "signed_out":
			return "Signed out";
		case "paused_by_risk_control":
			return "Paused by risk control";
		case "adapter_incompatible":
			return "Page changed";
		case "unavailable":
			return "Unavailable";
	}
}

function formatBeijingTime(value: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Shanghai",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(new Date(value));
}
