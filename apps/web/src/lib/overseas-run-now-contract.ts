export const OVERSEAS_RUN_NOW_DEFAULT_SAMPLES = 1 as const;
export const OVERSEAS_RUN_NOW_PAID_SAMPLES = 5 as const;

export type OverseasRunNowSamplesPerChannel =
	| typeof OVERSEAS_RUN_NOW_DEFAULT_SAMPLES
	| typeof OVERSEAS_RUN_NOW_PAID_SAMPLES;
