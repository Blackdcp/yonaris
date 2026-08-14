import type { PreparedResponseSnapshotBundle } from "./contract";

export type ResponseSnapshotAssetName = "html" | "json" | "manifest";

export type StoredResponseSnapshot = {
	storageBackend: "filesystem" | "kodo";
	storageKey: string;
	brandId: string;
	runId: string;
	revision: number;
	htmlSha256: string;
	jsonSha256: string;
	manifestSha256: string;
	htmlBytes: number;
	jsonBytes: number;
	manifestBytes: number;
	htmlGzipBytes: number;
	jsonGzipBytes: number;
};

export type ResponseSnapshotAsset = {
	asset: ResponseSnapshotAssetName;
	body: Uint8Array;
	contentType: string;
	contentEncoding: "gzip" | null;
	sha256: string;
	bytes: number;
	storedBytes: number;
};

export type ResponseSnapshotDownload = ResponseSnapshotAsset & {
	fileName: string;
};

export interface ResponseSnapshotStorage {
	put(bundle: PreparedResponseSnapshotBundle, revision?: number): Promise<StoredResponseSnapshot>;
	get(storageKey: string, asset: ResponseSnapshotAssetName): Promise<ResponseSnapshotAsset>;
	head(storageKey: string): Promise<StoredResponseSnapshot | null>;
	delete(storageKey: string): Promise<void>;
	createDownload(storageKey: string, asset: ResponseSnapshotAssetName): Promise<ResponseSnapshotDownload>;
}
