import { Logo } from "@/components/logo";
import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";
import { GlobalEnglishViewSwitch } from "./global-english-view-switch";

export function GlobalEnglishFooter({ activeKey }: { activeKey?: GlobalEnglishPageKey }) {
	return (
		<footer className="global-en__footer">
			<div>
				<a className="global-en__logo" href="/" aria-label="Yonaris home">
					<Logo variant="white" className="global-en__wordmark" />
				</a>
				<p>Reviewable AI market evidence for decisions that matter.</p>
				<GlobalEnglishViewSwitch activeKey={activeKey} />
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
