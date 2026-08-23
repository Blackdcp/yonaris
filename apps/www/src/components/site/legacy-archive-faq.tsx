import type { FaqItem } from "@/lib/faqs";

export function LegacyArchiveFaq({ items }: { items: FaqItem[] }): React.ReactNode {
	if (items.length === 0) return null;
	return (
		<section className="legacy-archive-section legacy-archive-faq" aria-labelledby="legacy-archive-faq-title">
			<p className="legacy-archive-kicker">Archived questions</p>
			<h2 className="legacy-archive-section__heading" id="legacy-archive-faq-title">
				Recorded source answers
			</h2>
			<p className="legacy-archive-faq__boundary" data-legacy-archived-answers>
				Recorded source answers — not current Yonaris claims. Supplier facts and availability may have changed since
				publication.
			</p>
			<ol className="legacy-archive-ledger">
				{items.map((item, index) => (
					<li className="legacy-archive-ledger__row" key={item.question}>
						<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
						<div>
							<h3>{item.question}</h3>
							<p>{item.answer}</p>
						</div>
						<span className="legacy-archive-ledger__arrow" aria-hidden="true">
							—
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
