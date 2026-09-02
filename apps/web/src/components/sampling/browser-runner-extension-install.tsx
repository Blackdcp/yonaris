import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Download, PackageCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import { useI18n } from "@/i18n/provider";

const EXTENSION_FILE_NAME = "yonaris-browser-extension.zip";
const EXTENSION_DOWNLOAD_URL = `/downloads/${EXTENSION_FILE_NAME}`;
const EXTENSION_METADATA_URL = "/downloads/yonaris-browser-extension.json";

export interface BrowserExtensionPackageMetadata {
	fileName: typeof EXTENSION_FILE_NAME;
	sha256: string;
	version: string;
}

type BrowserExtensionPackageMetadataResponse = {
	ok: boolean;
	json: () => Promise<unknown>;
};

type BrowserExtensionPackageMetadataFetcher = (
	url: string,
	init: RequestInit,
) => Promise<BrowserExtensionPackageMetadataResponse>;

export async function fetchBrowserExtensionPackageMetadata({
	signal,
	fetcher = fetch,
}: {
	signal?: AbortSignal;
	fetcher?: BrowserExtensionPackageMetadataFetcher;
} = {}): Promise<BrowserExtensionPackageMetadata> {
	const response = await fetcher(EXTENSION_METADATA_URL, {
		cache: "no-store",
		credentials: "same-origin",
		...(signal ? { signal } : {}),
	});
	if (!response.ok) throw new Error("Browser extension package metadata is unavailable");
	return parseBrowserExtensionPackageMetadata(await response.json());
}

export function BrowserRunnerExtensionInstall({
	metadata: providedMetadata,
}: {
	metadata?: BrowserExtensionPackageMetadata;
}) {
	const { t } = useI18n();
	const [metadata, setMetadata] = useState(providedMetadata);
	const [metadataError, setMetadataError] = useState<{ detail?: string } | null>(null);

	useEffect(() => {
		if (providedMetadata) return;
		const controller = new AbortController();
		fetchBrowserExtensionPackageMetadata({ signal: controller.signal })
			.then(setMetadata)
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setMetadataError({ detail: error instanceof Error ? error.message : undefined });
			});
		return () => controller.abort();
	}, [providedMetadata]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<PackageCheck className="size-5" />
					{t("sampling.extension.title")}
				</CardTitle>
				<CardDescription>{t("sampling.extension.description")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					{metadata ? (
						<Button asChild>
							<a href={`${EXTENSION_DOWNLOAD_URL}?sha256=${metadata.sha256}`} download={EXTENSION_FILE_NAME}>
								<Download /> {t("sampling.extension.download")}
							</a>
						</Button>
					) : (
						<Button disabled>
							<Download /> {t("sampling.extension.download")}
						</Button>
					)}
					{metadata && (
						<span className="text-sm text-muted-foreground">
							{t("sampling.extension.version", { version: metadata.version })}
						</span>
					)}
				</div>

				{metadata ? (
					<div className="space-y-1 text-xs text-muted-foreground">
						<p>SHA-256</p>
						<code className="block select-all break-all rounded bg-muted p-2 text-foreground">{metadata.sha256}</code>
					</div>
				) : metadataError ? (
					<Alert variant="destructive">
						<TriangleAlert />
						<AlertTitle>{t("sampling.extension.digestUnavailable")}</AlertTitle>
						<AlertDescription>
							<p>{t("sampling.extension.digestWarning")}</p>
							{metadataError.detail && (
								<LocalizedRawDetail labelId="sampling.raw.errorDetails" detail={metadataError.detail} />
							)}
						</AlertDescription>
					</Alert>
				) : (
					<p className="text-sm text-muted-foreground">{t("sampling.extension.loadingDigest")}</p>
				)}

				<ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
					<li>{t("sampling.extension.step.extract")}</li>
					<li>
						{t("sampling.extension.step.chrome.before")} <code className="text-foreground">chrome://extensions</code>
						{t("sampling.extension.step.chrome.middle")}{" "}
						<strong className="text-foreground">{t("sampling.extension.step.chrome.control")}</strong>
						{t("sampling.extension.step.chrome.after")}
					</li>
					<li>{t("sampling.extension.step.signIn")}</li>
					<li>{t("sampling.extension.step.pair")}</li>
				</ol>
			</CardContent>
		</Card>
	);
}

export function parseBrowserExtensionPackageMetadata(input: unknown): BrowserExtensionPackageMetadata {
	if (
		typeof input !== "object" ||
		input === null ||
		!("fileName" in input) ||
		input.fileName !== EXTENSION_FILE_NAME ||
		!("version" in input) ||
		typeof input.version !== "string" ||
		!/^\d+\.\d+\.\d+$/.test(input.version) ||
		!("sha256" in input) ||
		typeof input.sha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(input.sha256)
	) {
		throw new Error("Browser extension package metadata is invalid");
	}
	return { fileName: EXTENSION_FILE_NAME, sha256: input.sha256, version: input.version };
}
