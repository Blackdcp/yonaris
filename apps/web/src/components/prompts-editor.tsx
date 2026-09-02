import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Save } from "lucide-react";
import { useRef, useState } from "react";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import { type EditablePrompt, PromptsListEditor } from "@/components/prompts-list-editor";
import { useInvalidatePromptsSummary } from "@/hooks/use-prompts-summary";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { trackEvent } from "@/lib/posthog";
import { updatePromptsFn } from "@/server/prompts";

interface Prompt {
	id: string;
	value: string;
	enabled: boolean;
	tags?: string[];
	systemTags?: string[];
}

interface PromptsEditorProps {
	initialPrompts: Prompt[];
	brandId: string;
	scopeId: string;
	pageTitle: string;
	pageDescription: string;
}

type SubmittedPrompt = { id?: string; value: string; enabled: boolean; tags: string[] };
type UpdatePrompts = (input: {
	data: { brandId: string; scopeId: string; prompts: SubmittedPrompt[] };
}) => Promise<unknown>;

export type PromptsSubmissionResult =
	| {
			ok: true;
			submitted: { brandId: string; scopeId: string; prompts: SubmittedPrompt[] };
	  }
	| { ok: false; formError: MessageId };

export async function submitPromptsForm(
	input: {
		brandId: string;
		scopeId: string;
		initialPrompts: Array<{ id: string; value: string; enabled: boolean; tags?: string[] }>;
		prompts: EditablePrompt[];
	},
	updatePrompts: UpdatePrompts,
): Promise<PromptsSubmissionResult> {
	const validPrompts = input.prompts.filter((prompt) => prompt.value.trim());
	const currentIds = new Set(validPrompts.filter((prompt) => prompt.id).map((prompt) => prompt.id));
	const removedPrompts = input.initialPrompts
		.filter((prompt) => !currentIds.has(prompt.id))
		.map((prompt) => ({ id: prompt.id, value: prompt.value, enabled: false, tags: prompt.tags || [] }));
	const prompts = [
		...validPrompts.map((prompt) => ({
			...(prompt.id ? { id: prompt.id } : {}),
			value: prompt.value.trim(),
			enabled: prompt.enabled,
			tags: prompt.tags,
		})),
		...removedPrompts,
	];
	const submitted = { brandId: input.brandId, scopeId: input.scopeId, prompts };

	try {
		await updatePrompts({ data: submitted });
		return { ok: true, submitted };
	} catch (error) {
		return { ok: false, formError: customerSettingsErrorMessageId("prompts", error) };
	}
}

export function PromptsEditor({ initialPrompts, brandId, scopeId, pageTitle, pageDescription }: PromptsEditorProps) {
	const { t } = useI18n();
	const [prompts, setPrompts] = useState<EditablePrompt[]>(() =>
		initialPrompts.map((prompt) => ({
			id: prompt.id,
			_key: prompt.id,
			value: prompt.value,
			enabled: prompt.enabled,
			tags: prompt.tags || [],
			systemTags: prompt.systemTags || [],
		})),
	);
	const [isLoading, setIsLoading] = useState(false);
	const [formError, setFormError] = useState<MessageId | null>(null);
	const saveInProgress = useRef(false);
	const navigate = useNavigate();
	const invalidatePromptsSummary = useInvalidatePromptsSummary();

	const savePrompts = async () => {
		if (saveInProgress.current) return;

		saveInProgress.current = true;
		setIsLoading(true);
		setFormError(null);
		try {
			const result = await submitPromptsForm({ brandId, scopeId, initialPrompts, prompts }, updatePromptsFn);
			if (!result.ok) {
				setFormError(result.formError);
				return;
			}

			const currentIds = new Set(prompts.filter((prompt) => prompt.id).map((prompt) => prompt.id));
			const added = prompts.filter((prompt) => prompt.value.trim() && !prompt.id).length;
			const edited = prompts.filter((prompt) => prompt.value.trim() && prompt.id).length;
			const deleted = initialPrompts.filter((prompt) => !currentIds.has(prompt.id)).length;
			trackEvent("prompts_updated", { added, edited, deleted });

			invalidatePromptsSummary(brandId);
			navigate({ to: "/app/$brand/visibility", params: { brand: brandId }, search: { scope: scopeId } });
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setIsLoading(false);
			saveInProgress.current = false;
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
					<p className="text-muted-foreground">{pageDescription}</p>
				</div>
			</div>

			<PromptsListEditor prompts={prompts} onChange={setPrompts} />

			{formError && (
				<p className="text-sm text-destructive" role="alert">
					{t(formError)}
				</p>
			)}

			<div className="flex gap-2 items-center">
				<Button onClick={savePrompts} disabled={isLoading} size="sm" className="flex items-center gap-2 cursor-pointer">
					{isLoading ? (
						t("settings.prompts.saving")
					) : (
						<>
							<Save className="h-4 w-4" />
							{t("settings.prompts.save")}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
