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

// Compatibility aliases for packages that have not yet migrated their internal
// constant names. These are not user-visible product identifiers.
export const ELMO_BRAND_COLOR = DEFAULT_BRAND_COLOR;
export const ELMO_BRAND_FONT = YONARIS_BRAND_FONT;
export const ELMO_THEME_COLOR = DEFAULT_THEME_COLOR;
export const ELMO_BACKGROUND_COLOR = DEFAULT_BACKGROUND_COLOR;

/**
 * Default product chart colors. The first two carry the primary/focus
 * relationship used throughout the interface; the remaining hues provide
 * categorical range without colliding with status colors. Whitelabel
 * deployments can override this through VITE_CHART_COLORS.
 */
export const DEFAULT_CHART_COLORS = [
	// Core
	YONARIS_COLORS.slate,
	YONARIS_COLORS.signal,
	"#52677c",
	"#3e6259",
	"#8b6f5c",
	"#6e7f91",
	"#c57b45",
	"#4f6b75",
	"#82748a",
	"#9b835f",
	"#4c5968",
	// Dark
	YONARIS_COLORS.ink,
	"#c94f00",
	"#34485b",
	"#2b4a43",
	"#684f40",
	"#4a5a6a",
	"#96552a",
	"#354e57",
	"#61546a",
	"#746044",
	"#333d49",
	// Light
	"#7c8997",
	"#ff9a57",
	"#7e91a4",
	"#718e87",
	"#ae9382",
	"#98a5b1",
	"#dba17a",
	"#7b969e",
	"#a296a8",
	"#b5a789",
	YONARIS_COLORS.stone,
];
