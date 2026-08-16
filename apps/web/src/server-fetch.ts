import { applySecurityHeaders } from "./server-security-headers";

const RESPONSE_SNAPSHOT_ASSET_PATH =
	/^\/api\/app\/response-snapshots\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type FetchHandler = (request: Request) => Promise<Response> | Response;

type FetchApplicationResponseInput = {
	request: Request;
	directFetch: FetchHandler;
	instrumentedFetch: FetchHandler;
	securityHeaderOptions: {
		strictTransportSecurity: string;
		posthogOrigin: string | undefined;
	};
};

export function isImmutableResponseSnapshotAssetRequest(request: Request): boolean {
	return request.method === "GET" && RESPONSE_SNAPSHOT_ASSET_PATH.test(new URL(request.url).pathname);
}

export async function fetchApplicationResponse(input: FetchApplicationResponseInput): Promise<Response> {
	const fetchHandler = isImmutableResponseSnapshotAssetRequest(input.request)
		? input.directFetch
		: input.instrumentedFetch;
	const response = await fetchHandler(input.request);
	return applySecurityHeaders(input.request, response, input.securityHeaderOptions);
}
