import { MAX_PROMPTS } from "@workspace/lib/constants";
import type { MessageId } from "@/i18n/catalog";
import { BRAND_CREATION_ERROR_CODES } from "@/lib/brand-settings";

export type CustomerSettingsOperation =
	| "onboarding"
	| "brand"
	| "competitors"
	| "prompts"
	| "teamInvite"
	| "teamRemove"
	| "teamCancel";

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
		return error.message;
	}
	return "";
}

const exactMessages: Partial<Record<CustomerSettingsOperation, Readonly<Record<string, MessageId>>>> = {
	onboarding: {
		[BRAND_CREATION_ERROR_CODES.forbidden]: "customer.new.error.notAllowed",
		[BRAND_CREATION_ERROR_CODES.notAllowed]: "customer.new.error.notAllowed",
		"Not Found: Customer onboarding is not available to platform identities": "customer.onboarding.error.unavailable",
		"Failed to create brand": "customer.onboarding.error.create",
	},
	brand: {
		"Brand name must be a non-empty string": "settings.brand.validation.nameRequired",
		"Website URL is required": "settings.brand.validation.websiteRequired",
		"Please enter a valid website URL or domain": "settings.brand.validation.websiteInvalid",
		"Website URL must have a valid domain name": "settings.brand.validation.websiteInvalid",
		"Failed to update brand": "settings.brand.error.update",
	},
	prompts: {
		"Forbidden: Automatic prompt execution is managed by the platform": "settings.prompts.error.automaticScope",
		[`A measurement scope can contain at most ${MAX_PROMPTS} prompts`]: "settings.prompts.error.capacity",
		"Brand not found": "settings.prompts.error.brandNotFound",
	},
	teamInvite: {
		"Team invitations are not available in this deployment": "settings.team.error.unavailable",
	},
	teamRemove: {
		"Team invitations are not available in this deployment": "settings.team.error.unavailable",
		"You cannot remove yourself from the team": "settings.team.error.selfRemove",
	},
	teamCancel: {
		"Team invitations are not available in this deployment": "settings.team.error.unavailable",
	},
};

export function customerSettingsErrorMessageId(operation: CustomerSettingsOperation, error: unknown): MessageId {
	return exactMessages[operation]?.[errorMessage(error)] ?? "common.error.unexpected";
}
