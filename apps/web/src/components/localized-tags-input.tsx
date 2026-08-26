import { TagsInput, type TagsInputProps } from "@workspace/ui/components/tags-input";
import { useI18n } from "@/i18n/provider";

export function LocalizedTagsInput(props: TagsInputProps) {
	const { t } = useI18n();

	return (
		<TagsInput
			{...props}
			removeTagLabel={props.removeTagLabel ?? ((tag) => t("accessibility.removeTag", { tag }))}
			maximumReachedText={props.maximumReachedText ?? t("filter.maximumReached")}
			entryHintText={props.entryHintText ?? t("filter.entryHint")}
			addValueText={props.addValueText ?? t("filter.addValue")}
		/>
	);
}
