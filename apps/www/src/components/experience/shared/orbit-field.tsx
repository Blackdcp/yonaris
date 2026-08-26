import type { PointerEvent, ReactNode } from "react";

export function OrbitField({
	label,
	children,
	interactive = false,
}: {
	label: string;
	children: ReactNode;
	interactive?: boolean;
}) {
	function respondToPointer(event: PointerEvent<HTMLDivElement>) {
		const bounds = event.currentTarget.getBoundingClientRect();
		const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
		const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
		event.currentTarget.style.setProperty("--orbit-x", x.toFixed(3));
		event.currentTarget.style.setProperty("--orbit-y", y.toFixed(3));
	}

	function resetPointer(event: PointerEvent<HTMLDivElement>) {
		event.currentTarget.style.removeProperty("--orbit-x");
		event.currentTarget.style.removeProperty("--orbit-y");
	}

	return (
		<figure
			className="site-06-orbit"
			aria-label={label}
			data-orbit-interactive={interactive ? "true" : undefined}
			onPointerMove={interactive ? respondToPointer : undefined}
			onPointerLeave={interactive ? resetPointer : undefined}
		>
			<div className="site-06-orbit__rings" aria-hidden="true">
				<span data-orbit-ring="outer" />
				<span data-orbit-ring="middle" />
				<span data-orbit-ring="inner" />
			</div>
			<div className="site-06-orbit__content">{children}</div>
		</figure>
	);
}
