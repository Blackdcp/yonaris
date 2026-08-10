/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SITE_URL?: string;
	readonly VITE_PLAUSIBLE_DOMAIN?: string;
	readonly VITE_POSTHOG_KEY?: string;
	readonly VITE_POSTHOG_HOST?: string;
	readonly VITE_FOUNDER_CONTACT_EMAIL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// App version injected by Vite `define` (see vite.config.ts) from this
// package's package.json, which shares the fixed workspace release version.
declare const __APP_VERSION__: string;
