import type { ReactNode } from "react";

export function EvidenceSheet({
	label,
	children,
	annotation,
	className,
}: {
	label: string;
	children: ReactNode;
	annotation?: ReactNode;
	className?: string;
}) {
	return (
		<article
			className={["site-06-evidence-sheet", className].filter(Boolean).join(" ")}
			data-scene-object="evidence-sheet"
			aria-label={label}
		>
			<header className="site-06-evidence-sheet__label">{label}</header>
			<div className="site-06-evidence-sheet__body">{children}</div>
			{annotation ? <aside className="site-06-evidence-sheet__annotation">{annotation}</aside> : null}
		</article>
	);
}
