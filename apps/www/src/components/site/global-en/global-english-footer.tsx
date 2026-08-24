export function GlobalEnglishFooter() {
	return (
		<footer className="global-en__footer">
			<div>
				<a className="global-en__wordmark global-en__wordmark--light" href="/">
					YONARIS<span aria-hidden="true">·</span>
				</a>
				<p>Reviewable AI market evidence for decisions that matter.</p>
			</div>
			<nav aria-label="Footer navigation">
				<a href="/product">Product</a>
				<a href="/approach">How it works</a>
				<a href="/research">Evidence</a>
				<a href="/geo">GEO context</a>
				<a href="/company">Company</a>
				<a href="/diagnostic">Diagnostic</a>
				<a href="/privacy">Privacy</a>
			</nav>
			<p className="global-en__fineprint">© {new Date().getFullYear()} Yonaris. Evidence before conclusion.</p>
		</footer>
	);
}
