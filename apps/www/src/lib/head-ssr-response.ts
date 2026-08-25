import { type HandlerCallbackResult, type SsrResponse, stripSsrResponseBody } from "@tanstack/react-router/ssr/server";

const HEAD_STRIP_REASON = "HEAD document body stripped";

/**
 * Finalize the TanStack SSR result while it still owns the router cleanup
 * handle. Once createStartHandler unwraps this result to a plain Response,
 * cancelling the outer body is too late to dispose the SSR transform.
 */
export function finalizeHeadSsrResult<T extends HandlerCallbackResult>(
	request: Pick<Request, "method">,
	result: T,
): T | Promise<SsrResponse> {
	if (request.method.toUpperCase() !== "HEAD") return result;
	return stripSsrResponseBody(result, HEAD_STRIP_REASON);
}
