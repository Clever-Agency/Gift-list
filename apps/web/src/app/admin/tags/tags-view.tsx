"use client";

import { useState } from "react";
import { createTranslator } from "next-intl";
import {
  DEFAULT_LOCALE,
  type ActionResult,
  type CustomTagQueueItem,
  type TagCatalogItem,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import {
  Button,
  Column,
  Dialog,
  EmptyState,
  Heading,
  Text,
  Toast,
  XStack,
  YStack,
} from "@gift-list/ui";
import { rejectCustomTagAction } from "@/actions/custom-tag-admin";
import { ApproveTagForm, type NoticeTone } from "./approve-tag-form";
import styles from "../admin.module.css";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.tags" });
const tAdmin = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export type TagsViewProps = {
  /** Undecided custom texts, most used first; no owners and no SECRET wishes (AD-22). */
  queue: readonly CustomTagQueueItem[];
  /** The catalog tags an existing-tag approval can point at. */
  tags: readonly TagCatalogItem[];
};

type Notice = {
  message: string;
  tone: NoticeTone;
};

/** A network failure of a server action is one calm sentence, not a stuck button. */
async function safely<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

/**
 * Story 10.2 / `DESIGN.md` → `/admin`: the moderation queue of custom tag texts.
 * The table is a real `<table>` with a visually hidden `<caption>` and
 * `<th scope="col">` («Текст», «Использований», «Действия»); below 1024 px it
 * scrolls inside its own box. A row carries only the example spelling, the number
 * of wishes and the two decisions — never an author or a wish (AD-22).
 *
 * «Одобрить» opens the approve layer; «Отклонить» asks in a destructive
 * confirmation. Both answers refresh the server page and drop the line locally;
 * the result is a `role="status"` toast.
 */
export function TagsView({ queue, tags }: TagsViewProps) {
  const [rows, setRows] = useState<readonly CustomTagQueueItem[]>(queue);
  const [approving, setApproving] = useState<CustomTagQueueItem | null>(null);
  const [pendingReject, setPendingReject] = useState<CustomTagQueueItem | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function showNotice(message: string, tone: NoticeTone) {
    setNotice({ message, tone });
  }

  function removeRow(normalizedText: string) {
    setRows(function withoutRow(current) {
      return current.filter(function isOther(row) {
        return row.normalizedText !== normalizedText;
      });
    });
  }

  function handleApproved(normalizedText: string) {
    removeRow(normalizedText);
    setApproving(null);
    showNotice(t("toast.approved"), "success");
  }

  async function confirmReject() {
    if (pendingReject === null) return;

    const target = pendingReject;
    setRejecting(true);
    const result = await safely(function reject() {
      return rejectCustomTagAction({ normalizedText: target.normalizedText });
    });
    setRejecting(false);

    if (result === null) {
      showNotice(t("error.generic"), "error");
      return;
    }
    if (!result.ok) {
      showNotice(
        result.reason === "CUSTOM_TAG_DECIDED" ? t("error.decided") : t("error.generic"),
        "error",
      );
      return;
    }

    removeRow(target.normalizedText);
    setPendingReject(null);
    showNotice(t("toast.rejected"), "success");
  }

  return (
    <Column size="wide" flexGrow={1} paddingVertical="$section-gap">
      <YStack gap="$grid-gap">
        <Heading level={1} kind="display-sm">
          {t("heading")}
        </Heading>

        {rows.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className={styles.caption}>{t("tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("columns.text")}</th>
                  <th scope="col" className={styles.number}>
                    {t("columns.usage")}
                  </th>
                  <th scope="col">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(function renderRow(row) {
                  return (
                    <tr key={row.normalizedText}>
                      <td>{row.sampleText}</td>
                      <td className={styles.number}>{row.usageCount}</td>
                      <td className={styles.actions}>
                        <XStack gap="$2">
                          <Button
                            variant="outline"
                            label={t("approve")}
                            ariaLabel={t("approveLabel", { text: row.sampleText })}
                            onPress={function openApprove() {
                              setApproving(row);
                            }}
                          />
                          <Button
                            variant="ghost"
                            label={t("reject")}
                            ariaLabel={t("rejectLabel", { text: row.sampleText })}
                            onPress={function askReject() {
                              setPendingReject(row);
                            }}
                          />
                        </XStack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </YStack>

      {approving ? (
        <ApproveTagForm
          key={approving.normalizedText}
          open
          item={approving}
          tags={tags}
          onClose={function closeApprove() {
            setApproving(null);
          }}
          onApproved={handleApproved}
          onNotice={showNotice}
        />
      ) : null}

      <Dialog
        open={pendingReject !== null}
        role="alertdialog"
        title={t("rejectTitle")}
        description={t("rejectBody")}
        testID="admin-tag-reject"
        onClose={function cancelReject() {
          if (!rejecting) setPendingReject(null);
        }}
        actions={
          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button
              variant="ghost"
              label={t("cancel")}
              onPress={function cancel() {
                setPendingReject(null);
              }}
            />
            <Button
              variant="destructive"
              label={t("rejectConfirm")}
              busy={rejecting}
              onPress={function reject() {
                void confirmReject();
              }}
            />
          </XStack>
        }
      >
        <Text kind="body">{pendingReject?.sampleText ?? ""}</Text>
      </Dialog>

      {notice ? (
        <Toast
          message={notice.message}
          tone={notice.tone}
          closeLabel={tAdmin("toastClose")}
          onClose={function dismiss() {
            setNotice(null);
          }}
          testID="admin-tag-toast"
        />
      ) : null}
    </Column>
  );
}

TagsView.displayName = "TagsView";
