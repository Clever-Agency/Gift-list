"use client";

import { useState } from "react";
import { createTranslator } from "next-intl";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type ActionError,
  type ActionResult,
  type CustomTagQueueItem,
  type TagCatalogItem,
  type TagLabels,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import {
  Button,
  Choice,
  ChoiceList,
  Close,
  Dialog,
  Text,
  TextField,
  XStack,
  YStack,
} from "@gift-list/ui";
import { approveCustomTagAction } from "@/actions/custom-tag-admin";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.tags" });
const tAdmin = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export type NoticeTone = "success" | "error";

export type ApproveTagFormProps = {
  /** The queue line the moderator opened. */
  item: CustomTagQueueItem;
  /** The catalog tags an existing-tag approval can point at. */
  tags: readonly TagCatalogItem[];
  open: boolean;
  onClose: () => void;
  /** The line left the queue: the screen drops the row and announces the result. */
  onApproved: (normalizedText: string) => void;
  onNotice: (message: string, tone: NoticeTone) => void;
};

type Mode = "new" | "existing";

type LabelDraft = Record<string, string>;

type FieldErrors = Record<string, string | undefined>;

/** The default caption is the queue key, so the moderator only corrects it. */
function defaultLabels(text: string): LabelDraft {
  const labels: LabelDraft = {};
  SUPPORTED_LOCALES.forEach(function fill(locale) {
    labels[locale] = text;
  });
  return labels;
}

/** A network failure of a server action is one calm sentence, not a stuck layer. */
async function safely<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

/**
 * Story 10.2 / AD-22: approve one custom tag text into the fixed catalog. The
 * layer is the shared `Dialog` in its `detail` layout — the same presentation the
 * collection form of `/admin` uses. The dialog title names the text, so the
 * required heading is always there.
 *
 * Two modes: a new catalog tag (`slug` that never changes plus a caption for
 * every locale of `SUPPORTED_LOCALES`, prefilled from the queue key) or an
 * existing tag of the catalog. The contract is a discriminated union, so only
 * one shape leaves the form. Field errors stay under their fields; a decided text
 * or a network failure is a toast.
 */
export function ApproveTagForm({
  item,
  tags,
  open,
  onClose,
  onApproved,
  onNotice,
}: ApproveTagFormProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [slug, setSlug] = useState("");
  const [labels, setLabels] = useState<LabelDraft>(function initialLabels() {
    return defaultLabels(item.normalizedText);
  });
  const [tagId, setTagId] = useState("");
  const [slugError, setSlugError] = useState<string | undefined>(undefined);
  const [labelErrors, setLabelErrors] = useState<FieldErrors>({});
  const [tagError, setTagError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  function chooseMode(next: Mode) {
    setMode(next);
    setSlugError(undefined);
    setLabelErrors({});
    setTagError(undefined);
  }

  function changeLabel(locale: string, value: string) {
    setLabels(function withValue(current) {
      return { ...current, [locale]: value };
    });
  }

  function collectLabels(): TagLabels {
    const result = {} as TagLabels;
    SUPPORTED_LOCALES.forEach(function fill(locale) {
      result[locale] = labels[locale] ?? "";
    });
    return result;
  }

  function markLabelsInvalid(field: string) {
    const message = t("error.labelEmpty");
    if (field === "labels") {
      const all: FieldErrors = {};
      SUPPORTED_LOCALES.forEach(function fill(locale) {
        all[locale] = message;
      });
      setLabelErrors(all);
      return;
    }

    const locale = field.startsWith("labels.") ? field.slice("labels.".length) : "";
    setLabelErrors(locale === "" ? {} : { [locale]: message });
  }

  function applyFailure(result: ActionError) {
    if (result.reason === "CUSTOM_TAG_DECIDED") {
      onNotice(t("error.decided"), "error");
      return;
    }

    const field = result.field ?? "";
    if (field === "slug") {
      setSlugError(
        result.reason === "CUSTOM_TAG_SLUG_TAKEN" ? t("error.slugTaken") : t("error.slugInvalid"),
      );
      return;
    }
    if (field === "labels" || field.startsWith("labels.")) {
      markLabelsInvalid(field);
      return;
    }
    if (field === "tagId") {
      setTagError(t("error.tagMissing"));
      return;
    }
    onNotice(t("error.generic"), "error");
  }

  async function approve() {
    setSlugError(undefined);
    setLabelErrors({});
    setTagError(undefined);

    if (mode === "existing" && tagId === "") {
      setTagError(t("error.tagMissing"));
      return;
    }

    const input =
      mode === "new"
        ? { mode, normalizedText: item.normalizedText, slug, labels: collectLabels() }
        : { mode, normalizedText: item.normalizedText, tagId };

    setBusy(true);
    const result = await safely(function save() {
      return approveCustomTagAction(input);
    });
    setBusy(false);

    if (result === null) {
      onNotice(t("error.generic"), "error");
      return;
    }
    if (!result.ok) {
      applyFailure(result);
      return;
    }

    onApproved(item.normalizedText);
  }

  return (
    <Dialog
      open={open}
      title={t("approveTitle", { text: item.sampleText })}
      onClose={onClose}
      closeAction={{ label: tAdmin("close"), icon: <Close size={20} /> }}
      layout="detail"
      testID="admin-tag-approve"
      actions={
        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <Button variant="ghost" label={t("cancel")} onPress={onClose} />
          <Button
            label={t("save")}
            busy={busy}
            onPress={function save() {
              void approve();
            }}
          />
        </XStack>
      }
    >
      <YStack gap="$4">
        <Text kind="body">{t("usageCount", { count: item.usageCount })}</Text>

        <ChoiceList variant="row" label={t("modeLabel")} heading={t("modeLabel")}>
          <Choice
            variant="row"
            label={t("newTag")}
            selected={mode === "new"}
            onPress={function chooseNew() {
              chooseMode("new");
            }}
          />
          <Choice
            variant="row"
            label={t("existingTag")}
            selected={mode === "existing"}
            onPress={function chooseExisting() {
              chooseMode("existing");
            }}
          />
        </ChoiceList>

        {mode === "new" ? (
          <YStack gap="$3">
            <TextField
              label={t("fieldSlug")}
              value={slug}
              onChangeText={setSlug}
              hint={t("fieldSlugHint")}
              error={slugError}
            />
            {SUPPORTED_LOCALES.map(function renderLabelField(locale) {
              return (
                <TextField
                  key={locale}
                  label={t("fieldLabelLocale", { locale })}
                  value={labels[locale] ?? ""}
                  onChangeText={function change(value) {
                    changeLabel(locale, value);
                  }}
                  error={labelErrors[locale]}
                />
              );
            })}
          </YStack>
        ) : (
          <ChoiceList
            variant="row"
            label={t("fieldExisting")}
            heading={t("fieldExisting")}
            error={tagError}
            description={tags.length === 0 ? t("noCatalogTags") : undefined}
          >
            {tags.map(function renderTag(tag) {
              return (
                <Choice
                  key={tag.id}
                  variant="row"
                  label={tag.label}
                  hint={tag.slug}
                  selected={tagId === tag.id}
                  onPress={function choose() {
                    setTagId(tag.id);
                    setTagError(undefined);
                  }}
                />
              );
            })}
          </ChoiceList>
        )}
      </YStack>
    </Dialog>
  );
}

ApproveTagForm.displayName = "ApproveTagForm";
