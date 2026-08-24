import type { ReactNode } from "react";

export function GraphicFrame({
	label,
	type,
	children,
	dark = false,
}: {
	label: string;
	type: string;
	children: ReactNode;
	dark?: boolean;
}) {
	return (
		<figure
			className={`global-en__graphic${dark ? " global-en__graphic--dark" : ""}`}
			data-graphic={type}
			aria-label={label}
		>
			{children}
		</figure>
	);
}
