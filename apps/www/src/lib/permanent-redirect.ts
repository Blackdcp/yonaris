export function permanentRedirectResponse(request: Request, destinationPath: `/${string}`): Response {
	const query = new URL(request.url).search;
	return new Response(null, {
		status: 308,
		headers: { Location: `${destinationPath}${query}` },
	});
}
