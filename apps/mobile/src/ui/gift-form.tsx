import { CURRENCIES, VISIBILITIES } from "@gift-list/contracts";
import {
  Button,
  Choice,
  ChoiceList,
  Text,
  TextField,
  XStack,
  YStack,
  type FocusTarget,
} from "@gift-list/ui";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslations } from "use-intl";
import { isGiftFormDirty, type GiftFormDirtyValues } from "@/ui/gift-form-dirty";
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
  /**
   * The screen is saving: the submit button is disabled, and so is the cancel
   * button when there is one — leaving mid-request would drop the outcome.
   */
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
   * A counter the screen bumps to run the form's own submit. The discard
   * dialog's «Сохранить» uses it, so saving goes through the same validation
   * and the same `onSubmit` as the form's button.
   */
  submitRequest?: number;
  /**
   * Tells the screen whether the draft differs from the values it opened with,
   * so leaving can ask «Сохранить изменения?» (`EXPERIENCE.md` → Esc / scrim /
   * системное «назад»). Called only when the flag flips, never on mount.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Adds a ghost «Отмена» next to the submit button. The screen owns what leaving
   * means and whether a dirty draft asks «Сохранить изменения?» first; without
   * this prop the form renders exactly as before.
   */
  onCancel?: () => void;
  /** Overrides the cancel label; `action.cancel` («Отмена») by default. */
  cancelLabel?: string;
  /**
   * The wish is no longer open: visibility is frozen by the server, so the rows
   * show the stored value but cannot change it (`EXPERIENCE.md` → Правка
   * забронированного желания).
   */
  visibilityLocked?: boolean;
};

/**
 * What a screen can ask of the form from the outside: after the discard step
 * closes, focus goes back to the element that opened it — the form's «Отмена»
 * (`DESIGN.md` → App → Доступность «Куда уходит фокус»).
 */
export type GiftFormHandle = {
  focusCancel(): void;
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
export const GiftForm = forwardRef<GiftFormHandle, GiftFormProps>(function GiftForm(
  {
    initialValues,
    submitting,
    onSubmit,
    submitLabel,
    serverError,
    submitRequest,
    onDirtyChange,
    onCancel,
    cancelLabel,
    visibilityLocked = false,
  },
  ref,
) {
  const t = useTranslations("app.giftForm");
  const tVisibility = useTranslations("app.gift.visibility");
  const common = useTranslations("common");
  // Read once, like the field states below: `initialValues` prefills the edit form.
  const [initial] = useState<GiftFormDirtyValues>(function readInitialValues() {
    return {
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      link: initialValues?.link ?? "",
      price: initialPriceText(initialValues?.priceAmount),
      currency: initialValues?.priceCurrency ?? DEFAULT_CURRENCY,
      visibility: initialValues?.visibility ?? DEFAULT_VISIBILITY,
    };
  });
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
  const cancelRef = useRef<FocusTarget>(null);
  useImperativeHandle(
    ref,
    function createFormHandle() {
      return {
        focusCancel() {
          // react-native-web host nodes are DOM elements with `focus()`; native ones
          // are not, and there `Modal` keeps owning focus.
          const node = cancelRef.current as unknown as { focus?: () => void } | null;
          node?.focus?.();
        },
      };
    },
    [],
  );
  // `EXPERIENCE.md` → Price field: an empty amount does not show a currency.
  const showCurrency = price.trim() !== "";
  const serverField = serverErrorField(serverError?.field);
  const formError = serverError != null && serverField === null ? t("error.form") : null;
  const dirty = isGiftFormDirty(initial, {
    title,
    description,
    link,
    price,
    currency,
    visibility,
  });
  // Report only flips: the screen listens for «стал грязным» / «снова чистый», not
  // for every keystroke. The first render is not a flip, so nothing fires on mount.
  const lastDirty = useRef(dirty);
  useEffect(function reportDirtyChange() {
    if (lastDirty.current === dirty) return;
    lastDirty.current = dirty;
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // The discard dialog's «Сохранить» asks for the form's own submit: run it once per bump.
  const handledRequest = useRef(submitRequest ?? 0);
  useEffect(function runSubmitRequest() {
    if (submitRequest === undefined || submitRequest === handledRequest.current) return;
    handledRequest.current = submitRequest;
    submit();
  });

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

  function handleTitleChange(value: string) {
    setTitle(value);
    clearError("title");
  }

  function handleLinkChange(value: string) {
    setLink(value);
    clearError("link");
  }

  function handlePriceChange(value: string) {
    setPrice(value);
    clearError("price");
  }

  return (
    <YStack gap="$grid-gap">
      <TextField
        label={t("field.title")}
        value={title}
        onChangeText={handleTitleChange}
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
        multiline
        rows={4}
        input={{
          placeholder: t("field.descriptionPlaceholder"),
          maxLength: DESCRIPTION_MAX,
          autoCapitalize: "sentences",
        }}
      />
      <TextField
        label={t("field.link")}
        value={link}
        onChangeText={handleLinkChange}
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
        onChangeText={handlePriceChange}
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
        <Text kind="caption" tone="muted">
          {t("field.visibilityLocked")}
        </Text>
      ) : null}
      {formError ? (
        <Text kind="caption" tone="destructive" role="alert" aria-live="polite">
          {formError}
        </Text>
      ) : null}
      {onCancel ? (
        // Cancel on the left of the save button, the pair flush right (`DESIGN.md` → Форма).
        <XStack alignItems="center" justifyContent="flex-end" gap="$2">
          <Button
            ref={cancelRef as never}
            variant="ghost"
            label={cancelLabel ?? t("action.cancel")}
            onPress={onCancel}
            disabled={submitting}
            // A disabled «Отмена» keeps its place in the focus order.
            focusableWhenDisabled
          />
          <Button
            label={submitLabel ?? t("action.save")}
            onPress={submit}
            busy={submitting}
          />
        </XStack>
      ) : (
        <Button label={submitLabel ?? t("action.save")} onPress={submit} busy={submitting} />
      )}
    </YStack>
  );
});

GiftForm.displayName = "GiftForm";

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
 * by default), built from `ChoiceList` and `Choice` of `@gift-list/ui`. `DESIGN.md`
 * asks for a bottom sheet with radios on a phone; the same rows are reused by
 * `VisibilityPicker` (Story 2.3). Each variant keeps the same `radio` semantics: one
 * choice, the selected one is marked, and the option label is the accessible name.
 *
 * `labelHidden` keeps the accessible name of the group while the visible heading
 * comes from the surrounding layer (the picker title is a header of its own).
 *
 * `disabled` shows the stored value without letting it change (a wish that is no
 * longer open keeps its visibility frozen).
 *
 * `autoFocusRef` is only set by `VisibilityPicker`: it receives the node of the option
 * holding `autoFocusValue`, so the dialog can put focus there when it opens instead of
 * leaving it on the control the layer was opened from.
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
  autoFocusRef,
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
  /** The option whose node goes to `autoFocusRef`. */
  autoFocusValue?: T;
  /** Receives the node of the `autoFocusValue` option. */
  autoFocusRef?: RefObject<FocusTarget | null>;
}) {
  return (
    <ChoiceList
      label={label}
      heading={labelHidden ? undefined : label}
      variant={variant === "rows" ? "row" : "chip"}
      error={error}
    >
      {options.map((option) => {
        function handlePress() {
          onChange(option.value);
        }

        return (
          <Choice
            key={option.value}
            ref={option.value === autoFocusValue ? (autoFocusRef as never) : undefined}
            variant={variant === "rows" ? "row" : "chip"}
            label={option.label}
            hint={option.hint}
            selected={option.value === value}
            disabled={disabled}
            onPress={handlePress}
          />
        );
      })}
    </ChoiceList>
  );
}

ChoiceGroup.displayName = "ChoiceGroup";
