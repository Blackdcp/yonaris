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

export interface Site06ResponsiveImageProps {
	readonly image: CinematicFieldImage;
	readonly priority?: boolean;
	readonly className?: string;
	readonly sizes?: string;
}

const DEFAULT_RESPONSIVE_SIZES = "(max-width: 720px) 100vw, (max-width: 1440px) 100vw, 1440px";

const RESPONSIVE_IMAGE_BASES: Readonly<Record<string, string>> = {
	"/brand/site-06/decision-room-original.jpg": "decision-room",
	"/brand/site-06/glass-passage-original.jpg": "glass-passage",
	"/brand/site-06/working-session-original.jpg": "working-session",
};

type CinematicStyle = CSSProperties & {
	"--site-06-focal-position"?: string;
	"--site-06-tonal-overlay"?: string;
};

export function Site06ResponsiveImage({
	image,
	priority = false,
	className,
	sizes = DEFAULT_RESPONSIVE_SIZES,
}: Site06ResponsiveImageProps) {
	const responsiveBase = RESPONSIVE_IMAGE_BASES[image.src];
	const srcSet = responsiveBase
		? [640, 1024, 1440].map((width) => `/brand/site-06/${responsiveBase}-${width}.jpg ${width}w`).join(", ")
		: undefined;

	return (
		<picture data-responsive-site-06-image={srcSet ? "true" : undefined}>
			{srcSet ? <source type="image/jpeg" srcSet={srcSet} sizes={sizes} /> : null}
			<img
				className={className}
				src={image.src}
				alt={image.alt}
				width={image.width}
				height={image.height}
				loading={priority ? "eager" : "lazy"}
				fetchPriority={priority ? "high" : "auto"}
				decoding="async"
			/>
		</picture>
	);
}

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
			<Site06ResponsiveImage image={image} priority={priority} className="site-06-cinematic__media" />
			<div className="site-06-cinematic__content">{children}</div>
			{credit ? <figcaption className="site-06-cinematic__credit">{credit}</figcaption> : null}
		</section>
	);
}
