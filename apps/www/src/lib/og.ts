export function getPageImage(slugs: string[]) {
	const segments = [...slugs, "image.png"];

	return {
		segments,
		url: `/og/docs/${segments.join("/")}`,
	};
}

export function getMarketingOgImage(opts: { title: string; description?: string }): string {
	// The rendered card already shows the Yonaris brand, so a "Features · Yonaris"
	// or "Yonaris · AI Visibility & GEO" title would render the brand
	// twice. Strip the brand prefix/suffix here. The og:title meta keeps the
	// full string for crawlers — only the image gets the cleaner version.
	const cleanTitle = opts.title.replace(/^Yonaris\s*[·\-|:]\s*/i, "").replace(/\s*[·\-|:]\s*Yonaris$/i, "");
	const params = new URLSearchParams();
	params.set("title", cleanTitle);
	if (opts.description) params.set("description", opts.description);
	return `/og.png?${params.toString()}`;
}
