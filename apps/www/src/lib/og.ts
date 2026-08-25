export function getMarketingOgImage(options: { title: string; description?: string }): string {
	const title = options.title.replace(/^Yonaris\s*[·\-|:]\s*/i, "").replace(/\s*[·\-|:]\s*Yonaris$/i, "");
	const parameters = new URLSearchParams({ title });
	if (options.description) parameters.set("description", options.description);
	return `/og.png?${parameters.toString()}`;
}
