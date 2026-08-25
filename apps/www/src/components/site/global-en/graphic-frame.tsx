import type { ReactNode } from "react";

export function GraphicFrame({
	label,
	type,
	children,
	dark = false,
	protagonist,
	progressive,
}: {
	label: string;
	type: string;
	children: ReactNode;
	dark?: boolean;
	protagonist?: string;
	progressive?: "non-hijacking";
}) {
	return (
		<figure
			className={`global-en__graphic${dark ? " global-en__graphic--dark" : ""}`}
			data-graphic={type}
			data-protagonist={protagonist}
			data-progressive={progressive}
			aria-label={label}
		>
			{children}
		</figure>
	);
}
