const contexts = {
	"legacy-research": {
		title: "Legacy research archive",
		body: "This material remains available for reference while its identity, scope, and facts are reviewed.",
	},
	"upstream-comparison": {
		title: "Upstream comparison archive",
		body: "This is an upstream Elmo comparison archive, retained as technical history rather than current Yonaris company positioning.",
	},
} as const;

export function LegacyArchiveContext({ kind }: { kind: keyof typeof contexts }): React.ReactNode {
	const context = contexts[kind];
	return (
		<aside className="site-archive-context" aria-label={context.title}>
			<strong>{context.title}</strong>
			<p>{context.body}</p>
		</aside>
	);
}
