import {
  CURRENCIES,
  DEFAULT_QUANTITY,
  GIFT_TAG_TEXT_MAX,
  QUANTITIES,
  VISIBILITIES,
} from "@gift-list/contracts";
import {
  Button,
  Choice,
  ChoiceList,
  TagChip,
  Text,
  TextField,
  XStack,
  YStack,
  type FieldInputRef,
  type FocusTarget,
} from "@gift-list/ui";
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslations } from "use-intl";
import { isGiftFormDirty, type GiftFormDirtyValues } from "@/ui/gift-form-dirty";
import {
  customTagIssue,
  giftTagKey,
  giftTagLabel,
  giftTagsKey,
  isCustomTag,
  isFixedTag,
  tagTextLength,
  type CustomTagIssue,
  type GiftFormTag,
} from "@/ui/gift-form-tags";
import type { TagCatalogState } from "@/ui/use-tag-catalog";
import {
  DESCRIPTION_MAX,
  LINK_MAX,
  TITLE_MAX,
  fieldErrorCopy,
  firstErrorField,
  serverErrorField,
  tagErrorKey,
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

/** `QUANTITIES` is the closed set; `GiftInput["quantity"]` is the same union. */
type Quantity = (typeof QUANTITIES)[number];

/** D-37: an amount without a picked currency is USD. */
const DEFAULT_CURRENCY: Currency = "USD";

/** ARCH-A17: a new wish is visible to everyone. */
const DEFAULT_VISIBILITY: Visibility = "PUBLIC";

/** No catalogue prop (older callers and unit tests): ready with nothing to offer. */
const EMPTY_TAG_CATALOG: TagCatalogState = { status: "ready", tags: [] };

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
  /** Story 2.5: `SINGLE` or `UNLIMITED`, `SINGLE` by default. */
  quantity: Quantity;
  /**
   * Story 2.5: the selected fixed tags (`catalogId`, server label) and custom
   * texts. The screen turns them into `{ catalogId }` / `{ text }`.
   */
  tags: GiftFormTag[];
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
   * Receives the trimmed text fields, the price as minor units, and the choices of
   * visibility and quantity. Empty description and link arrive as `null`.
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
  /**
   * Story 2.5: `quantity` is frozen once the wish is no longer open, exactly like
   * visibility. The rows show the stored value, disabled, with a hint why.
   */
  quantityLocked?: boolean;
  /**
   * Story 2.5: the fixed tag catalogue and its request state. The selected tags
   * live in the form, so a failed or empty catalogue never clears them; the
   * prop only decides which fixed tags can still be offered.
   */
  tagCatalog?: TagCatalogState;
  /** Runs the catalogue request again from the error state. */
  onRetryTagCatalog?: () => void;
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
 * errors (subtask 17). Story 2.5 adds the `SINGLE`/`UNLIMITED` quantity and the
 * tag picker (microtask 2.5.6): fixed tags from the server catalogue plus custom
 * text, with the selected set kept here so a failed or empty catalogue never
 * clears it. State
 * stays local and controlled, so later subtasks add
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
    quantityLocked = false,
    tagCatalog = EMPTY_TAG_CATALOG,
    onRetryTagCatalog,
  },
  ref,
) {
  const t = useTranslations("app.giftForm");
  const tVisibility = useTranslations("app.gift.visibility");
  const tQuantity = useTranslations("app.gift.quantity");
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
      quantity: initialValues?.quantity ?? DEFAULT_QUANTITY,
      tags: giftTagsKey(initialValues?.tags ?? []),
      customTag: "",
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
  const [quantity, setQuantity] = useState<Quantity>(
    initialValues?.quantity ?? DEFAULT_QUANTITY,
  );
  const [tags, setTags] = useState<GiftFormTag[]>(
    function readInitialTags() {
      return initialValues?.tags ?? [];
    },
  );
  const [customTag, setCustomTag] = useState("");
  const [customTagError, setCustomTagError] = useState<CustomTagIssue | null>(null);
  // UI4: the field and «Добавить тег» stay hidden until the «Свой тег» chip opens them.
  const [customTagOpen, setCustomTagOpen] = useState(false);
  const customTagInputRef = useRef<FieldInputRef | null>(null);
  const customTagEditorId = useId();
  const [errors, setErrors] = useState<GiftFormErrors>({});
  const tagErrorId = useId();
  // Q-09: the tag identities in the order the last submit sent them. A server
  // `tags.N` error names a position in that list, not in the current chips.
  const submittedTagKeys = useRef<readonly string[]>([]);
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
  // UI4: the field takes focus as soon as the trigger opens it, so touch and
  // keyboard users land straight in the input (and the phone opens the keyboard).
  useEffect(
    function focusCustomTagEditor() {
      if (customTagOpen) {
        (customTagInputRef.current as { focus?: () => void } | null)?.focus?.();
      }
    },
    [customTagOpen],
  );
  // `EXPERIENCE.md` → Price field: an empty amount does not show a currency.
  const showCurrency = price.trim() !== "";
  const serverField = serverErrorField(serverError?.field);
  const formError = serverError != null && serverField === null ? t("error.form") : null;
  const catalogTags = tagCatalog.status === "ready" ? tagCatalog.tags : [];
  // A selected fixed tag from an older catalogue or a failed fetch keeps its
  // stored server label: nothing is dropped because the offer is incomplete.
  const missingFixedTags = tags
    .filter(isFixedTag)
    .filter((tag) => !catalogTags.some((item) => item.id === tag.catalogId));
  const fixedOptions = [
    ...missingFixedTags.map((tag) => ({ id: tag.catalogId, label: tag.label })),
    ...catalogTags.map((item) => ({ id: item.id, label: item.label })),
  ];
  const selectedFixedIds = new Set(
    tags.filter(isFixedTag).map((tag) => tag.catalogId),
  );
  const customTags = tags.filter(isCustomTag);

  /**
   * The catalogue is the source of fixed-tag labels (AD-27): an untouched tag
   * from an older card picks up the label of the current request language. The
   * identity stays `catalogId`, so this never makes the draft dirty.
   */
  function withCatalogueLabels(selected: readonly GiftFormTag[]): GiftFormTag[] {
    if (catalogTags.length === 0) return [...selected];
    const labels = new Map(catalogTags.map((item) => [item.id, item.label]));
    return selected.map((tag) => {
      if (!isFixedTag(tag)) return tag;
      const label = labels.get(tag.catalogId);
      return label === undefined || label === tag.label ? tag : { ...tag, label };
    });
  }
  const dirty = isGiftFormDirty(initial, {
    title,
    description,
    link,
    price,
    currency,
    visibility,
    quantity,
    tags: giftTagsKey(tags),
    customTag,
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

  const tagServerError =
    serverField === "tags"
      ? copyText(fieldErrorCopy("tags", { tagServerField: serverError?.field }))
      : undefined;
  // Q-09: one rejected tag gets its own chip; anything without a live position
  // stays the group-level error the form already showed.
  const tagErrorTargetKey =
    tagServerError === undefined
      ? null
      : tagErrorKey(
          serverError?.field,
          submittedTagKeys.current,
          tags.map(giftTagKey),
        );
  const tagChipError =
    tagServerError === undefined ? undefined : { id: tagErrorId, message: tagServerError };
  const customTagErrorCopy = customTagError
    ? copyText(fieldErrorCopy("tags", { tagIssue: customTagError }))
    : undefined;

  function clearError(field: GiftFormField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /**
   * Toggles one fixed tag by its catalogue id. The label is stored only for the
   * case where a later catalogue does not contain the tag any more.
   */
  function toggleFixedTag(catalogId: string, label: string) {
    setTags((current) =>
      current.some((tag) => isFixedTag(tag) && tag.catalogId === catalogId)
        ? current.filter((tag) => !(isFixedTag(tag) && tag.catalogId === catalogId))
        : [...current, { catalogId, label }],
    );
    clearError("tags");
    setCustomTagError(null);
  }

  function removeCustomTag(text: string) {
    setTags((current) =>
      current.filter((tag) => !(isCustomTag(tag) && tag.text === text)),
    );
    clearError("tags");
    setCustomTagError(null);
  }

  function handleCustomTagChange(value: string) {
    setCustomTag(value);
    setCustomTagError(null);
    clearError("tags");
  }

  /** UI4: the «Свой тег» chip is the only entry point to the custom-tag field. */
  function openCustomTagEditor() {
    setCustomTagOpen(true);
    (customTagInputRef.current as { focus?: () => void } | null)?.focus?.();
  }

  /** Adds the typed custom tag; empty, invalid, too long and duplicate text never lands. */
  function addCustomTag() {
    const issue = customTagIssue(customTag, tags);
    if (issue !== null) {
      setCustomTagError(issue);
      AccessibilityInfo.announceForAccessibility(
        copyText(fieldErrorCopy("tags", { tagIssue: issue })),
      );
      return;
    }
    setTags((current) => [...current, { text: customTag.trim() }]);
    setCustomTag("");
    setCustomTagError(null);
    clearError("tags");
  }

  function submit() {
    // Text left in the custom field is a tag the owner meant to add: submit it
    // instead of dropping it silently, but only when it passes the same rule.
    let tagsForSubmit = tags;
    let tagIssue: CustomTagIssue | null = null;
    if (customTag.trim() !== "") {
      tagIssue = customTagIssue(customTag, tags);
      if (tagIssue === null) {
        tagsForSubmit = [...tags, { text: customTag.trim() }];
        setTags(tagsForSubmit);
        setCustomTag("");
      }
    }
    setCustomTagError(tagIssue);

    const priceAmount = parsePriceToMinor(price);
    const found = validateGiftForm({ title, link, price });
    if (tagIssue !== null) found.tags = true;
    setErrors(found);
    const first = firstErrorField(found);
    if (first !== null) {
      // `EXPERIENCE.md` → Accessibility Floor: announce the first error on submit.
      AccessibilityInfo.announceForAccessibility(
        copyText(fieldErrorCopy(first, { title, tagIssue })),
      );
      return;
    }
    // `validateGiftForm` already reported it; this only narrows the type.
    if (priceAmount === "invalid") return;
    const submittedTags = withCatalogueLabels(tagsForSubmit);
    // The server indexes tags in body order; keep exactly that list for Q-09.
    submittedTagKeys.current = submittedTags.map(giftTagKey);
    onSubmit({
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      link: link.trim() === "" ? null : link.trim(),
      priceAmount,
      priceCurrency: priceAmount === null ? null : currency,
      visibility,
      quantity,
      tags: submittedTags,
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
        description={visibilityLocked ? t("field.visibilityLocked") : undefined}
        options={VISIBILITIES.map((code) => ({
          value: code,
          label: tVisibility(code),
          hint: t(`field.visibilityHint.${code}`),
        }))}
      />
      <ChoiceGroup
        variant="rows"
        label={t("field.quantity")}
        value={quantity}
        onChange={setQuantity}
        error={inlineError("quantity")}
        disabled={quantityLocked}
        description={quantityLocked ? t("field.quantityLocked") : undefined}
        options={QUANTITIES.map((code) => ({
          value: code,
          label: tQuantity(code),
          hint: t(`field.quantityHint.${code}`),
        }))}
      />
      <YStack gap="$1">
        <Text kind="label">{t("field.tags")}</Text>
        {tagCatalog.status === "loading" ? (
          <Text kind="caption" tone="muted" aria-live="polite">
            {t("field.tagsLoading")}
          </Text>
        ) : null}
        {tagCatalog.status === "error" ? (
          <YStack gap="$2">
            <Text kind="caption" tone="destructive" role="alert" aria-live="polite">
              {t("field.tagsError")}
            </Text>
            {onRetryTagCatalog ? (
              <Button
                variant="secondary"
                label={t("field.tagsRetry")}
                onPress={onRetryTagCatalog}
              />
            ) : null}
          </YStack>
        ) : null}
        {tagCatalog.status === "ready" && fixedOptions.length === 0 ? (
          <YStack gap="$2">
            <Text kind="caption" tone="muted">
              {t("field.tagsEmpty")}
            </Text>
            {onRetryTagCatalog ? (
              <Button
                variant="secondary"
                label={t("field.tagsRetry")}
                onPress={onRetryTagCatalog}
              />
            ) : null}
          </YStack>
        ) : null}
        {/* UI4: one strip — «Свой тег» first, then the live preview, the committed
            custom tags and the fixed catalogue. A chip error stays on its chip; the
            group carries the message only when no chip can (Q-09). */}
        <XStack
          role="group"
          aria-label={t("field.tags")}
          aria-invalid={tagServerError && tagErrorTargetKey === null ? true : undefined}
          aria-describedby={
            tagServerError && tagErrorTargetKey === null ? tagErrorId : undefined
          }
          flexWrap="wrap"
          gap="$2"
        >
          <TagChip
            testID="custom-tag-trigger"
            variant="custom"
            role="button"
            label={t("field.tagCustom")}
            expanded={customTagOpen}
            controls={customTagOpen ? customTagEditorId : undefined}
            onPress={openCustomTagEditor}
          />
          {customTag.trim() !== "" ? (
            <TagChip
              testID="custom-tag-preview"
              variant="custom"
              preview
              label={customTag.trim()}
            />
          ) : null}
          {customTags.map((tag, index) => {
            const label = giftTagLabel(tag);

            function handleRemove() {
              removeCustomTag(tag.text);
            }

            return (
              <TagChip
                key={giftTagKey(tag)}
                testID={`custom-tag-${index}`}
                variant="custom"
                label={label}
                removeLabel={t("field.tagRemove", { name: label })}
                onRemove={handleRemove}
                error={tagErrorTargetKey === giftTagKey(tag) ? tagChipError : undefined}
              />
            );
          })}
          {fixedOptions.map((option) => {
            function handlePress() {
              toggleFixedTag(option.id, option.label);
            }

            const optionKey = giftTagKey({ catalogId: option.id, label: option.label });

            return (
              <TagChip
                key={option.id}
                label={option.label}
                selected={selectedFixedIds.has(option.id)}
                onPress={handlePress}
                error={tagErrorTargetKey === optionKey ? tagChipError : undefined}
              />
            );
          })}
        </XStack>
        {customTagOpen ? (
          <YStack id={customTagEditorId} gap="$2">
            <TextField
              ref={customTagInputRef}
              label={t("field.tagCustom")}
              value={customTag}
              onChangeText={handleCustomTagChange}
              error={customTagErrorCopy}
              hint={t("field.tagCounter", {
                count: tagTextLength(customTag),
                max: GIFT_TAG_TEXT_MAX,
              })}
              input={{
                placeholder: t("field.tagCustomPlaceholder", { max: GIFT_TAG_TEXT_MAX }),
                autoCapitalize: "sentences",
                onSubmitEditing: addCustomTag,
              }}
            />
            <XStack>
              <Button
                variant="secondary"
                label={t("field.tagAdd")}
                onPress={addCustomTag}
                disabled={customTag.trim() === ""}
              />
            </XStack>
          </YStack>
        ) : null}
        {tagServerError ? (
          <Text
            id={tagErrorId}
            kind="caption"
            tone="destructive"
            role="alert"
            aria-live="polite"
          >
            {tagServerError}
          </Text>
        ) : null}
      </YStack>
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
 * The shared `radiogroup` behind the currency codes, the visibility choice and the
 * `SINGLE`/`UNLIMITED` quantity (`DESIGN.md` → Форма: five codes; radio rows with
 * an explanation, «Всем» and «Один раз» by default), built from `ChoiceList` and
 * `Choice` of `@gift-list/ui`. `DESIGN.md` asks for a bottom sheet with radios on
 * a phone; the same rows are reused by `VisibilityPicker` (Story 2.3). Each
 * variant keeps the same `radio` semantics: one choice, the selected one is
 * marked, and the option label is the accessible name.
 *
 * `labelHidden` keeps the accessible name of the group while the visible heading
 * comes from the surrounding layer (the picker title is a header of its own).
 *
 * `disabled` shows the stored value without letting it change (a wish that is no
 * longer open keeps its visibility and quantity frozen).
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
  description,
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
  /** Persistent explanation under the group, e.g. why the stored value cannot change. */
  description?: string;
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
      description={description}
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
