import type { CSSProperties, ReactNode } from "react";

export interface CinematicFieldImage {
	readonly src: string;
	readonly alt: string;
	readonly focalPosition?: string;
}

type CinematicStyle = CSSProperties & {
	"--site-06-focal-position"?: string;
	"--site-06-tonal-overlay"?: string;
};

export function CinematicField({
	image,
	children,
	credit,
	overlay,
	className,
}: {
	image: CinematicFieldImage;
	children: ReactNode;
	credit?: ReactNode;
	overlay?: string;
	className?: string;
}) {
	const style: CinematicStyle = {
		"--site-06-focal-position": image.focalPosition ?? "center center",
		"--site-06-tonal-overlay": overlay,
	};

	return (
		<section
			className={["site-06-cinematic", className].filter(Boolean).join(" ")}
			data-scene-object="cinematic-field"
			style={style}
		>
			<img className="site-06-cinematic__media" src={image.src} alt={image.alt} />
			<div className="site-06-cinematic__content">{children}</div>
			{credit ? <small className="site-06-cinematic__credit">{credit}</small> : null}
		</section>
	);
}
