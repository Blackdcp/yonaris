import type { CSSProperties, ReactNode } from "react";

export interface CinematicFieldImage {
	readonly src: string;
	readonly alt: string;
	readonly focalPosition?: string;
	readonly width?: number;
	readonly height?: number;
}

export interface CinematicFieldProps {
	readonly image: CinematicFieldImage;
	readonly children: ReactNode;
	readonly credit?: string;
	readonly priority?: boolean;
	readonly overlay?: string;
	readonly className?: string;
}

type CinematicStyle = CSSProperties & {
	"--site-06-focal-position"?: string;
	"--site-06-tonal-overlay"?: string;
};

export function CinematicField({ image, children, credit, priority = false, overlay, className }: CinematicFieldProps) {
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
			<img
				className="site-06-cinematic__media"
				src={image.src}
				alt={image.alt}
				width={image.width}
				height={image.height}
				loading={priority ? "eager" : "lazy"}
				fetchPriority={priority ? "high" : "auto"}
				decoding="async"
			/>
			<div className="site-06-cinematic__content">{children}</div>
			{credit ? <figcaption className="site-06-cinematic__credit">{credit}</figcaption> : null}
		</section>
	);
}
