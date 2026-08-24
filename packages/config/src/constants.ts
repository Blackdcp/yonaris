/**
 * Shared constants used across all deployment configurations.
 */

/**
 * Default branding values for local/demo modes. Whitelabel mode does not use
 * these defaults; all values must be provided through its environment.
 */
export const DEFAULT_APP_NAME = "Yonaris";
export const DEFAULT_APP_ICON = "/icons/yonaris-icon.svg";
export const DEFAULT_APP_WORDMARK = "/brand/yonaris-wordmark-navy.png";
export const DEFAULT_APP_WORDMARK_ON_DARK = "/brand/yonaris-wordmark-white.png";
export const DEFAULT_APP_URL = "http://localhost:3000/";

/**
 * Brand values shared by icons, manifests, social cards, email, and product UI.
 */
export const YONARIS_COLORS = {
	ink: "#0b1220",
	paper: "#f6f4f1",
	slate: "#1e2a39",
	stone: "#8a95a3",
	mist: "#dde2e8",
	signal: "#ff6a00",
	blueGray: "#2f3e50",
} as const;

export const DEFAULT_BRAND_COLOR = YONARIS_COLORS.ink;
export const DEFAULT_THEME_COLOR = YONARIS_COLORS.ink;
export const DEFAULT_BACKGROUND_COLOR = YONARIS_COLORS.paper;
export const YONARIS_BRAND_FONT = "Geist Sans";

/**
 * Tonal data palette derived only from the approved Yonaris hues. Signal
 * Orange identifies the tracked brand; neutral series use Ink, Slate,
 * Blue Gray, Stone, and their tonal steps. Functional success/error colors
 * are intentionally not part of this palette.
 */
export const YONARIS_DATA_COLORS = [
	YONARIS_COLORS.signal,
	YONARIS_COLORS.slate,
	YONARIS_COLORS.blueGray,
	YONARIS_COLORS.stone,
	YONARIS_COLORS.ink,
	"#4a5664",
	"#64717e",
	"#768390",
	"#9da7b2",
	"#b7bec6",
	"#c7cdd3",
	"#d2d7dc",
	"#c94f00",
	"#e65f00",
	"#ff8533",
	"#ff9f66",
	"#364554",
	"#526273",
] as const;

/** Whitelabel deployments can override this through VITE_CHART_COLORS. */
export const DEFAULT_CHART_COLORS = [...YONARIS_DATA_COLORS];
