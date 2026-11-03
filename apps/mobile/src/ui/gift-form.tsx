import { CURRENCIES } from "@gift-list/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { formatMinorToPrice, parsePriceToMinor } from "@/ui/gift-price";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";

/** Same caps as `giftInputSchema` in `packages/contracts/src/gift.ts`. */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

/** `CURRENCIES` is the closed set; `GiftInput["priceCurrency"]` is the same union. */
type Currency = (typeof CURRENCIES)[number];

/** D-37: an amount without a picked currency is USD. */
const DEFAULT_CURRENCY: Currency = "USD";

/**
 * State of the fields Story 2.2 ships. Subtasks 16–17 add link and visibility,
 * so screens already talk to the form through a type.
 */
export type GiftFormValues = {
  title: string;
  description: string | null;
  /** Integer minor units (two decimals), or `null` when the price field is empty (AD-25). */
  priceAmount: number | null;
  /** `null` exactly when `priceAmount` is `null`: an amount always carries a code (AD-25). */
  priceCurrency: Currency | null;
};

type GiftFormProps = {
  /** Prefills the edit form; read once, so remount with `key` to load another wish. */
  initialValues?: Partial<GiftFormValues>;
  /** The screen is saving: the submit button is disabled, nothing else is locked. */
  submitting: boolean;
  /** Receives the trimmed title and description, and the price as minor units, or `null` when empty. */
  onSubmit: (values: GiftFormValues) => void;
  /** Create and edit pass their own label (`action.create` / `action.save`). */
  submitLabel?: string;
};

/**
 * Create/edit wish form (`EXPERIENCE.md` → Форма желания, `DESIGN.md` → Форма).
 * Story 2.2: title, description, and the optional price with its currency
 * (subtask 15); link and visibility arrive with subtask 16, inline errors with
 * subtask 17. State stays local and controlled, so later subtasks add
 * their inputs next to these without changing the screen contract.
 * Required fields are not marked, optional ones carry «(необязательно)» in the
 * label (`EXPERIENCE.md` → Accessibility Floor).
 */
export function GiftForm({ initialValues, submitting, onSubmit, submitLabel }: GiftFormProps) {
  const t = useTranslations("app.giftForm");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(initialPriceText(initialValues?.priceAmount));
  const [currency, setCurrency] = useState<Currency>(
    initialValues?.priceCurrency ?? DEFAULT_CURRENCY,
  );
  // `EXPERIENCE.md` → Price field: an empty amount does not show a currency.
  const showCurrency = price.trim() !== "";

  function submit() {
    const trimmedDescription = description.trim();
    const priceAmount = parsePriceToMinor(price);
    // TODO(Story 2.2, subtask 17): show `error.priceInvalid` under the field.
    if (priceAmount === "invalid") return;
    onSubmit({
      title: title.trim(),
      description: trimmedDescription === "" ? null : trimmedDescription,
      priceAmount,
      priceCurrency: priceAmount === null ? null : currency,
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t("field.title")}
        value={title}
        onChangeText={setTitle}
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
        label={t("field.price")}
        value={price}
        onChangeText={setPrice}
        hint={showCurrency ? t("field.priceHint") : undefined}
        input={{
          placeholder: t("field.pricePlaceholder"),
          keyboardType: "decimal-pad",
          inputMode: "decimal",
        }}
      />
      {showCurrency ? (
        <CurrencyPicker label={t("field.currency")} value={currency} onChange={setCurrency} />
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

/**
 * `DESIGN.md` → Форма: five codes, USD by default. `DESIGN.md` asks for a bottom
 * sheet with radios on a phone; until it exists (Story 2.3 builds the visibility
 * rows the same way) a row of pressed chips carries the same `radio` semantics:
 * one choice, the selected one is filled, and the code is the accessible name.
 */
function CurrencyPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.codes}>
        {CURRENCIES.map((code) => {
          const selected = code === value;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityLabel={code}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(code)}
              style={({ pressed }) => [
                styles.code,
                selected ? styles.codeSelected : null,
                pressed ? styles.codePressed : null,
              ]}
            >
              <Text style={[styles.codeLabel, selected ? styles.codeLabelSelected : null]}>
                {code}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  codes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing["grid-gap"] / 2,
  },
  code: {
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
  codeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  codePressed: {
    opacity: 0.9,
  },
  codeLabel: {
    ...textStyle("label"),
    color: colors.foreground,
  },
  codeLabelSelected: {
    color: colors["primary-foreground"],
  },
});
