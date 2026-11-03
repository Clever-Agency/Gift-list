import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { spacing } from "@/theme/tokens";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";

/** Same caps as `giftInputSchema` in `packages/contracts/src/gift.ts`. */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

/**
 * State of the fields Story 2.2 ships first. Subtasks 15–17 add price, currency,
 * link and visibility to it, so screens already talk to the form through a type.
 */
export type GiftFormValues = {
  title: string;
  description: string | null;
};

type GiftFormProps = {
  /** Prefills the edit form; read once, so remount with `key` to load another wish. */
  initialValues?: Partial<GiftFormValues>;
  /** The screen is saving: the submit button is disabled, nothing else is locked. */
  submitting: boolean;
  /** Receives the trimmed title and the description, or `null` when it is empty. */
  onSubmit: (values: GiftFormValues) => void;
  /** Create and edit pass their own label (`action.create` / `action.save`). */
  submitLabel?: string;
};

/**
 * Create/edit wish form (`EXPERIENCE.md` → Форма желания, `DESIGN.md` → Форма).
 * Story 2.2, subtask 14: title and description only. State stays local and
 * controlled, so later subtasks add their inputs next to these without changing
 * the screen contract; inline errors arrive with subtask 17.
 * Required fields are not marked, optional ones carry «(необязательно)» in the
 * label (`EXPERIENCE.md` → Accessibility Floor).
 */
export function GiftForm({ initialValues, submitting, onSubmit, submitLabel }: GiftFormProps) {
  const t = useTranslations("app.giftForm");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");

  function submit() {
    const trimmedDescription = description.trim();
    onSubmit({
      title: title.trim(),
      description: trimmedDescription === "" ? null : trimmedDescription,
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t("field.title")}
        value={title}
        onChangeText={setTitle}
        input={{
          maxLength: TITLE_MAX,
          autoCapitalize: "sentences",
        }}
      />
      <TextField
        label={t("field.description")}
        value={description}
        onChangeText={setDescription}
        inputStyle={styles.descriptionInput}
        input={{
          multiline: true,
          numberOfLines: 4,
          maxLength: DESCRIPTION_MAX,
          textAlignVertical: "top",
          autoCapitalize: "sentences",
        }}
      />
      <PrimaryButton
        label={submitLabel ?? t("action.save")}
        onPress={submit}
        disabled={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing["grid-gap"],
  },
  descriptionInput: {
    minHeight: spacing["control-height"] * 2,
    paddingVertical: spacing["grid-gap"] / 2,
  },
});
