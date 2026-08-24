import { GraphicFrame } from "../graphic-frame";

const demo = "Interface demonstration — no customer or live observation data.";

export function EvidenceWindow() {
	return (
		<GraphicFrame label="Evidence window demonstration" type="evidence-window">
			<div className="global-en__window-bar">
				<span>Evidence window</span>
				<span>Defined market question</span>
			</div>
			<div className="global-en__window-tabs">
				<b>Answer</b>
				<span>Comparison</span>
				<span>Available sources</span>
				<span>Next test</span>
			</div>
			<div className="global-en__window-body">
				<div>
					<small>QUESTION</small>
					<p>How is the target brand represented in a defined buying question?</p>
				</div>
				<ol>
					<li>
						<b>Answer state</b>
						<span>No observation loaded</span>
					</li>
					<li>
						<b>Evidence state</b>
						<span>Available sources appear here</span>
					</li>
					<li>
						<b>Review state</b>
						<span>Awaiting human review</span>
					</li>
				</ol>
			</div>
			<figcaption>{demo}</figcaption>
		</GraphicFrame>
	);
}

export function ScopeRings() {
	return (
		<GraphicFrame label="Four scope layers" type="scope-rings" dark>
			<div className="global-en__rings" aria-hidden="true">
				<i />
				<i />
				<i />
				<i />
			</div>
			<ol className="global-en__number-rail">
				<li>
					<em>01</em>Define the scope
				</li>
				<li>
					<em>02</em>Observe the answers
				</li>
				<li>
					<em>03</em>Inspect available evidence
				</li>
				<li>
					<em>04</em>Choose the next reviewed test
				</li>
			</ol>
		</GraphicFrame>
	);
}

export function EvidencePath() {
	const steps = [
		["01", "Question", "Defined scope"],
		["02", "Answer", "Comparable sample"],
		["03", "Evidence", "Known / unknown"],
		["04", "Next test", "Reviewed decision"],
	];
	return (
		<GraphicFrame label="Evidence path" type="evidence-path">
			<ol className="global-en__path">
				{steps.map(([n, title, state]) => (
					<li key={n}>
						<em>{n}</em>
						<b>{title}</b>
						<span>{state}</span>
					</li>
				))}
			</ol>
		</GraphicFrame>
	);
}

export function EvidenceLedger() {
	return (
		<GraphicFrame label="Measurement ledger" type="evidence-ledger" dark>
			<table className="global-en__ledger">
				<caption>Schema-only evidence record</caption>
				<thead>
					<tr>
						<th>Ledger field</th>
						<th>Definition</th>
						<th>Current state</th>
					</tr>
				</thead>
				<tbody>
					{[
						["Market + question", "Defined observation scope", "Not configured"],
						["Surface + time", "Collection conditions", "No observation loaded"],
						["Valid denominator", "Samples eligible for comparison", "No observation loaded"],
						["Answer + sources", "Reviewable evidence", "Not applicable in this interface demonstration"],
						["Finding", "Bounded interpretation", "Awaiting human review"],
					].map((row) => (
						<tr key={row[0]}>
							{row.map((cell) => (
								<td key={cell}>{cell}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<figcaption>{demo}</figcaption>
		</GraphicFrame>
	);
}

export function EntryMap() {
	const nodes = [
		["Discovery", "Where does the brand enter?"],
		["Description", "How is it explained?"],
		["Comparison", "What frames the choice?"],
		["Available sources", "What evidence is exposed?"],
		["Repeat observation", "What changed in the same scope?"],
	];
	return (
		<GraphicFrame label="Five-node answer entry map" type="entry-map">
			<ol className="global-en__node-map">
				{nodes.map(([title, q], i) => (
					<li key={title}>
						<em>0{i + 1}</em>
						<b>{title}</b>
						<span>{q}</span>
					</li>
				))}
			</ol>
		</GraphicFrame>
	);
}

export function OperatingModel() {
	return (
		<GraphicFrame label="Operating model" type="operating-model">
			<div className="global-en__model">
				<div>
					<small>INPUT</small>
					<b>Customer question</b>
					<span>Market + decision</span>
				</div>
				<i aria-hidden="true">→</i>
				<div>
					<small>WORKFLOW</small>
					<b>Yonaris evidence workflow</b>
					<span>Configured collection + human review</span>
				</div>
				<i aria-hidden="true">→</i>
				<div>
					<small>OUTPUT</small>
					<b>Reviewable decision</b>
					<span>One next test</span>
				</div>
			</div>
		</GraphicFrame>
	);
}

export function DiagnosticPreview() {
	return (
		<GraphicFrame label="Diagnostic deliverable preview" type="diagnostic-preview">
			<ol className="global-en__deliverables">
				<li>
					<em>01</em>
					<b>Scoped baseline</b>
				</li>
				<li>
					<em>02</em>
					<b>Selected answer and available-source evidence</b>
				</li>
				<li>
					<em>03</em>
					<b>Clearest information gaps</b>
				</li>
				<li>
					<em>04</em>
					<b>Reviewed next-test candidates</b>
				</li>
			</ol>
		</GraphicFrame>
	);
}

export function PrivacyFlow() {
	return (
		<GraphicFrame label="Privacy verification flow" type="privacy-flow">
			<div className="global-en__model">
				<div>
					<small>01</small>
					<b>Verified notice</b>
				</div>
				<i aria-hidden="true">→</i>
				<div>
					<small>02</small>
					<b>Region gate</b>
				</div>
				<i aria-hidden="true">→</i>
				<div>
					<small>03</small>
					<b>Submission enabled</b>
				</div>
			</div>
		</GraphicFrame>
	);
}

export function ResponsibilityLanes() {
	return (
		<GraphicFrame label="Responsibility lanes" type="responsibility-lanes">
			<div className="global-en__lanes">
				<div>
					<small>SYSTEM</small>
					<b>Configured answer records</b>
				</div>
				<div>
					<small>YONARIS</small>
					<b>Collection and evidence review</b>
				</div>
				<div>
					<small>CUSTOMER</small>
					<b>Decision and next-test approval</b>
				</div>
			</div>
		</GraphicFrame>
	);
}
