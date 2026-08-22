import type { DeepReadonly } from "@/content/site/types";
import type { IllustrativeEvidenceRecord, ResearchContent, ResearchItem } from "@/content/site/research";

function ResearchItemList({ items }: { items: readonly DeepReadonly<ResearchItem>[] }): React.ReactNode {
	return (
		<ul>
			{items.map((item) => (
				<li key={item.id}>{item.text}</li>
			))}
		</ul>
	);
}

interface ResearchLedgerProps {
	labels: DeepReadonly<ResearchContent["labels"]>;
	record: DeepReadonly<IllustrativeEvidenceRecord>;
}

export function ResearchLedger({ labels, record }: ResearchLedgerProps): React.ReactNode {
	return (
		<article className="research-ledger" data-record-status={record.status} aria-labelledby="research-ledger-title">
			<header className="research-ledger__header">
				<div className="research-ledger__status">
					<span aria-hidden="true" />
					<p>{record.label}</p>
				</div>
				<p className="research-ledger__record-id">{record.id}</p>
			</header>

			<div className="research-ledger__layout">
				<div className="research-ledger__metadata">
					<p className="research-ledger__section-label">{labels.recordMetadata}</p>
					<h2 id="research-ledger-title">{record.title}</h2>
					<dl>
						<div>
							<dt>{labels.scope}</dt>
							<dd>{record.scope}</dd>
						</div>
						<div>
							<dt>{labels.observedAt}</dt>
							<dd>
								<time dateTime={record.observedAtIso}>{record.observedAtLabel}</time>
							</dd>
						</div>
						<div>
							<dt>{labels.sampleCount}</dt>
							<dd>
								<data value={record.sampleCount}>{record.sampleCount}</data>
							</dd>
						</div>
						<div>
							<dt>{labels.surface}</dt>
							<dd>{record.surface}</dd>
						</div>
					</dl>
				</div>

				<div className="research-ledger__evidence">
					<section className="research-ledger__question" data-record-section="question">
						<p className="research-ledger__section-label">{labels.question}</p>
						<h3>{record.question}</h3>
					</section>

					<section className="research-ledger__answer" data-record-section="answer">
						<p className="research-ledger__section-label">{labels.answer}</p>
						<p>{record.answer}</p>
					</section>

					<div className="research-ledger__availability-grid">
						<section data-record-section="citations" data-availability-state={record.citations.state}>
							<header>
								<h3>{labels.citations}</h3>
								<span>{record.citations.state === "known" ? labels.known : labels.unknown}</span>
							</header>
							{record.citations.state === "known" ? (
								<ResearchItemList items={record.citations.value} />
							) : (
								<p>{record.citations.reason}</p>
							)}
						</section>

						<section data-record-section="exposed-queries" data-availability-state={record.exposedQueries.state}>
							<header>
								<h3>{labels.exposedQueries}</h3>
								<span>{record.exposedQueries.state === "known" ? labels.known : labels.unknown}</span>
							</header>
							{record.exposedQueries.state === "known" ? (
								<ResearchItemList items={record.exposedQueries.value} />
							) : (
								<p>{record.exposedQueries.reason}</p>
							)}
						</section>
					</div>

					<div className="research-ledger__conclusion-grid">
						<section data-record-section="findings">
							<p className="research-ledger__section-label">{labels.findings}</p>
							<ResearchItemList items={record.findings} />
						</section>
						<section data-record-section="unknowns">
							<p className="research-ledger__section-label">{labels.unknowns}</p>
							<ResearchItemList items={record.unknowns} />
						</section>
					</div>
				</div>
			</div>
		</article>
	);
}
