import { CURRENCIES, VISIBILITIES } from "@gift-list/contracts";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { focusInLayer } from "@/ui/focus";
import {
  DESCRIPTION_MAX,
  LINK_MAX,
  TITLE_MAX,
  fieldErrorCopy,
  firstErrorField,
  serverErrorField,
  validateGiftForm,
  type GiftFormErrorCopy,
  type GiftFormErrors,
  type GiftFormField,
} from "@/ui/gift-form-validation";
import { formatMinorToPrice, parsePriceToMinor } from "@/ui/gift-price";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";

/** `CURRENCIES` is the closed set; `GiftInput["priceCurrency"]` is the same union. */
type Currency = (typeof CURRENCIES)[number];

/** `VISIBILITIES` is the closed set; `GiftInput["visibility"]` is the same union. */
type Visibility = (typeof VISIBILITIES)[number];

/** D-37: an amount without a picked currency is USD. */
const DEFAULT_CURRENCY: Currency = "USD";

/** ARCH-A17: a new wish is visible to everyone. */
const DEFAULT_VISIBILITY: Visibility = "PUBLIC";

/** The fields the form edits; screens map them onto `GiftInput` / `GiftUpdate`. */
export type GiftFormValues = {
  title: string;
  description: string | null;
  /** Trimmed link, or `null` when the field is empty (D-25). */
  link: string | null;
  /** Integer minor units (two decimals), or `null` when the price field is empty (AD-25). */
  priceAmount: number | null;
  /** `null` exactly when `priceAmount` is `null`: an amount always carries a code (AD-25). */
  priceCurrency: Currency | null;
  visibility: Visibility;
};

/**
 * A `VALIDATION` result the screen received, handed to the form for display.
 * `field` is `ActionError.field`; `message` is accepted with the error shape but
 * the catalog stays the single source of copy (`EXPERIENCE.md` → Строки).
 */
export type GiftFormServerError = {
  field?: string;
  message?: string;
};

type GiftFormProps = {
  /** Prefills the edit form; read once, so remount with `key` to load another wish. */
  initialValues?: Partial<GiftFormValues>;
  /** The screen is saving: the submit button is disabled, nothing else is locked. */
  submitting: boolean;
  /**
   * Receives the trimmed text fields, the price as minor units, and the choice of
   * visibility. Empty description and link arrive as `null`.
   */
  onSubmit: (values: GiftFormValues) => void;
  /** Create and edit pass their own label (`action.create` / `action.save`). */
  submitLabel?: string;
  /**
   * A server field error to show inline, or a form-level one above the button
   * when the field is unknown. The screen owns it: clear the prop on the next
   * submit.
   */
  serverError?: GiftFormServerError | null;
  /**
   * The wish is no longer open: visibility is frozen by the server, so the rows
   * show the stored value but cannot change it (`EXPERIENCE.md` → Правка
   * забронированного желания).
   */
  visibilityLocked?: boolean;
};

/**
 * Create/edit wish form (`EXPERIENCE.md` → Форма желания, `DESIGN.md` → Форма).
 * Story 2.2: title, description, the optional link (subtask 16), the optional
 * price with its currency (subtask 15), visibility (subtask 16), and inline
 * errors (subtask 17). State stays local and controlled, so later subtasks add
 * their inputs next to these without changing the screen contract. Required
 * fields are not marked, optional ones carry «(необязательно)» in the label
 * (`EXPERIENCE.md` → Accessibility Floor).
 *
 * Validation runs on submit, not while typing: a field error disappears as soon
 * as that field is edited, and the first error is announced for the screen
 * reader (`EXPERIENCE.md` → Ошибки форм, → Accessibility Floor).
 */
export function GiftForm({
  initialValues,
  submitting,
  onSubmit,
  submitLabel,
  serverError,
  visibilityLocked = false,
}: GiftFormProps) {
  const t = useTranslations("app.giftForm");
  const tVisibility = useTranslations("app.gift.visibility");
  const common = useTranslations("common");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [link, setLink] = useState(initialValues?.link ?? "");
  const [price, setPrice] = useState(initialPriceText(initialValues?.priceAmount));
  const [currency, setCurrency] = useState<Currency>(
    initialValues?.priceCurrency ?? DEFAULT_CURRENCY,
  );
  const [visibility, setVisibility] = useState<Visibility>(
    initialValues?.visibility ?? DEFAULT_VISIBILITY,
  );
  const [errors, setErrors] = useState<GiftFormErrors>({});
  // `EXPERIENCE.md` → Price field: an empty amount does not show a currency.
  const showCurrency = price.trim() !== "";
  const serverField = serverErrorField(serverError?.field);
  const formError = serverError != null && serverField === null ? t("error.form") : null;

  function copyText(copy: GiftFormErrorCopy): string {
    return copy.catalog === "giftForm" ? t(copy.key, copy.values) : common(copy.key);
  }

  function inlineError(field: GiftFormField): string | undefined {
    if (errors[field]) return copyText(fieldErrorCopy(field, { title }));
    return serverField === field ? copyText(fieldErrorCopy(field, { title })) : undefined;
  }

  function clearError(field: GiftFormField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit() {
    const priceAmount = parsePriceToMinor(price);
    const found = validateGiftForm({ title, link, price });
    setErrors(found);
    const first = firstErrorField(found);
    if (first !== null) {
      // `EXPERIENCE.md` → Accessibility Floor: announce the first error on submit.
      AccessibilityInfo.announceForAccessibility(copyText(fieldErrorCopy(first, { title })));
      return;
    }
    // `validateGiftForm` already reported it; this only narrows the type.
    if (priceAmount === "invalid") return;
    onSubmit({
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      link: link.trim() === "" ? null : link.trim(),
      priceAmount,
      priceCurrency: priceAmount === null ? null : currency,
      visibility,
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t("field.title")}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          clearError("title");
        }}
        error={inlineError("title")}
        input={{
          placeholder: t("field.titlePlaceholder"),
          maxLength: TITLE_MAX,
          autoCapitalize: "sentences",
        }}
      />
      <TextField
        label={t("field.description")}
        value={description}
        onChangeText={setDescription}
        error={inlineError("description")}
        inputStyle={styles.descriptionInput}
        input={{
          placeholder: t("field.descriptionPlaceholder"),
          multiline: true,
          numberOfLines: 4,
          maxLength: DESCRIPTION_MAX,
          textAlignVertical: "top",
          autoCapitalize: "sentences",
        }}
      />
      <TextField
        label={t("field.link")}
        value={link}
        onChangeText={(value) => {
          setLink(value);
          clearError("link");
        }}
        error={inlineError("link")}
        input={{
          placeholder: t("field.linkPlaceholder"),
          keyboardType: "url",
          autoCapitalize: "none",
          autoCorrect: false,
          maxLength: LINK_MAX,
        }}
      />
      <TextField
        label={t("field.price")}
        value={price}
        onChangeText={(value) => {
          setPrice(value);
          clearError("price");
        }}
        error={inlineError("price")}
        hint={showCurrency ? t("field.priceHint") : undefined}
        input={{
          placeholder: t("field.pricePlaceholder"),
          keyboardType: "decimal-pad",
          inputMode: "decimal",
        }}
      />
      {showCurrency ? (
        <ChoiceGroup
          variant="chips"
          label={t("field.currency")}
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
        />
      ) : null}
      <ChoiceGroup
        variant="rows"
        label={t("field.visibility")}
        value={visibility}
        onChange={setVisibility}
        error={inlineError("visibility")}
        disabled={visibilityLocked}
        options={VISIBILITIES.map((code) => ({
          value: code,
          label: tVisibility(code),
          hint: t(`field.visibilityHint.${code}`),
        }))}
      />
      {visibilityLocked ? (
        <Text style={styles.lockedHint}>{t("field.visibilityLocked")}</Text>
      ) : null}
      {formError ? (
        <Text
          style={styles.formError}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {formError}
        </Text>
      ) : null}
      <PrimaryButton
        label={submitLabel ?? t("action.save")}
        onPress={submit}
        disabled={submitting}
      />
    </View>
  );
}

/** The stored amount back as editable text: `25000` → `"250"`, `25050` → `"250.50"`. */
function initialPriceText(priceAmount: number | null | undefined): string {
  return priceAmount == null ? "" : formatMinorToPrice(priceAmount);
}

type ChoiceOption<T extends string> = {
  value: T;
  /** Visible text and the accessible name of its radio. */
  label: string;
  /** Second line under the label on `rows`, also the accessible hint. */
  hint?: string;
};

/**
 * The shared `radiogroup` behind the currency codes and the visibility choice
 * (`DESIGN.md` → Форма: five codes; three radio rows with an explanation, «Всем»
 * by default). `DESIGN.md` asks for a bottom sheet with radios on a phone; the
 * same rows are reused by `VisibilityPicker` (Story 2.3). Each variant keeps the
 * same `radio` semantics: one choice, the selected one is marked, and the option
 * label is the accessible name.
 *
 * `labelHidden` keeps the accessible name of the group while the visible heading
 * comes from the surrounding layer (the picker title is a header of its own).
 *
 * `autoFocusValue` is only set by `VisibilityPicker`: when the dialog appears,
 * focus moves to the radio holding the current value instead of staying on the
 * scrim the layer was opened from.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  variant,
  error,
  labelHidden,
  disabled = false,
  autoFocusValue,
}: {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  variant: "chips" | "rows";
  /** Inline error under the group, e.g. a server `visibility` rejection. */
  error?: string;
  /** The group is named for screen readers, but the visible copy is rendered elsewhere. */
  labelHidden?: boolean;
  /** Shows the stored value but does not let it change; every radio reads as disabled. */
  disabled?: boolean;
  /** Focus this option when the group appears; no other usage passes it. */
  autoFocusValue?: T;
}) {
  const rows = variant === "rows";
  const autoFocusRef = useRef<ComponentRef<typeof Pressable>>(null);

  useEffect(() => {
    if (autoFocusValue === undefined) return;
    focusInLayer(autoFocusRef.current);
  }, [autoFocusValue]);

  return (
    <View style={styles.field}>
      {labelHidden ? null : <Text style={styles.label}>{label}</Text>}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        accessibilityHint={error}
        style={rows ? styles.rows : styles.chips}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              ref={option.value === autoFocusValue ? autoFocusRef : undefined}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (!disabled) onChange(option.value);
              }}
              style={({ pressed }) => [
                rows ? styles.row : styles.chip,
                selected ? (rows ? styles.rowSelected : styles.chipSelected) : null,
                disabled ? styles.disabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {rows ? (
                <>
                  <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]}>
                      {option.label}
                    </Text>
                    {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
                  </View>
                </>
              ) : (
                <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>
                  {option.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
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
  field: {
    gap: 4,
  },
  label: {
    ...textStyle("label"),
    color: colors.foreground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing["grid-gap"] / 2,
  },
  chip: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors["border-strong"],
    borderRadius: rounded.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...textStyle("label"),
    color: colors.foreground,
  },
  chipLabelSelected: {
    color: colors["primary-foreground"],
  },
  rows: {
    gap: spacing["grid-gap"] / 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing["grid-gap"] / 2,
    minHeight: spacing["touch-target"],
    paddingVertical: spacing["grid-gap"] / 2,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors["border-strong"],
    borderRadius: rounded.sm,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    backgroundColor: colors.muted,
    borderColor: colors.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: rounded.full,
    borderWidth: 2,
    borderColor: colors["border-strong"],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: rounded.full,
    backgroundColor: colors.primary,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...textStyle("label"),
    color: colors.foreground,
  },
  rowLabelSelected: {
    color: colors.primary,
  },
  hint: {
    ...textStyle("caption"),
    color: colors["muted-foreground"],
  },
  lockedHint: {
    ...textStyle("caption"),
    color: colors["muted-foreground"],
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    ...textStyle("caption"),
    color: colors.destructive,
  },
  formError: {
    ...textStyle("caption"),
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.9,
  },
});
