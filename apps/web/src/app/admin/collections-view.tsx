"use client";

import { useState } from "react";
import { createTranslator } from "next-intl";
import {
  DEFAULT_LOCALE,
  formatDate,
  type ActionResult,
  type EditorialCollectionAdminDetail,
  type EditorialCollectionAdminSummary,
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
import { deleteCollectionAction, loadCollectionAction } from "@/actions/editorial-admin";
import { CollectionForm, type NoticeTone } from "./collection-form";
import styles from "./admin.module.css";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.collections" });
const tAdmin = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export type CollectionsViewProps = {
  /** Every collection, drafts and published alike, newest first (Story 10.1). */
  collections: readonly EditorialCollectionAdminSummary[];
};

type FormState = {
  open: boolean;
  collection: EditorialCollectionAdminDetail | null;
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

/** The table row of a stored collection: the detail without its ideas. */
function summaryOf(collection: EditorialCollectionAdminDetail): EditorialCollectionAdminSummary {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverImageUrl: collection.coverImageUrl,
    itemCount: collection.itemCount,
    publishedAt: collection.publishedAt,
    updatedAt: collection.updatedAt,
  };
}

/**
 * Story 10.1 / `DESIGN.md` → `/admin`: the collections table and the form entry.
 * The table is a real `<table>` (TanStack Table is not a dependency of the
 * project) with a visually hidden `<caption>` and `<th scope="col">`; below
 * 1024 px it scrolls inside its own box instead of widening the page.
 *
 * Rows show the title, the number of ideas, the publication state, the moment
 * the collection last changed (`formatDate`, `ru`) and the row actions. An
 * empty list is one calm sentence, and the create action stays in the header.
 */
export function CollectionsView({ collections }: CollectionsViewProps) {
  const [rows, setRows] = useState<readonly EditorialCollectionAdminSummary[]>(collections);
  const [form, setForm] = useState<FormState>({ open: false, collection: null });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EditorialCollectionAdminSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function showNotice(message: string, tone: NoticeTone) {
    setNotice({ message, tone });
  }

  function openCreate() {
    setForm({ open: true, collection: null });
  }

  async function openEdit(row: EditorialCollectionAdminSummary) {
    setLoadingId(row.id);
    const result = await safely(function load() {
      return loadCollectionAction(row.id);
    });
    setLoadingId(null);
    if (result === null || !result.ok) {
      showNotice(t("error.generic"), "error");
      return;
    }
    setForm({ open: true, collection: result.data });
  }

  function closeForm() {
    setForm({ open: false, collection: null });
  }

  function applyChanged(collection: EditorialCollectionAdminDetail) {
    const summary = summaryOf(collection);
    setRows(function upsertRow(current) {
      return current.some(function hasRow(row) {
        return row.id === summary.id;
      })
        ? current.map(function replaceRow(row) {
            return row.id === summary.id ? summary : row;
          })
        : [summary, ...current];
    });
    setForm(function keepForm(current) {
      return current.open ? { open: true, collection } : current;
    });
  }

  async function confirmDelete() {
    if (pendingDelete === null) return;

    const target = pendingDelete;
    setDeleting(true);
    const result = await safely(function remove() {
      return deleteCollectionAction(target.id);
    });
    setDeleting(false);

    if (result === null || !result.ok) {
      showNotice(t("error.generic"), "error");
      return;
    }

    const removedId = target.id;
    setRows(function withoutRow(current) {
      return current.filter(function isOther(row) {
        return row.id !== removedId;
      });
    });
    if (form.collection?.id === removedId) closeForm();
    setPendingDelete(null);
    showNotice(t("toast.deleted"), "success");
  }

  return (
    <Column size="wide" flexGrow={1} paddingVertical="$section-gap">
      <YStack gap="$grid-gap">
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <Heading level={1} kind="display-sm">
            {t("heading")}
          </Heading>
          <Button label={t("create")} onPress={openCreate} />
        </XStack>

        {rows.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className={styles.caption}>{t("tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("columns.title")}</th>
                  <th scope="col" className={styles.number}>
                    {t("columns.items")}
                  </th>
                  <th scope="col">{t("columns.status")}</th>
                  <th scope="col">{t("columns.updated")}</th>
                  <th scope="col">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(function renderRow(row) {
                  return (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td className={styles.number}>{row.itemCount}</td>
                      <td>{row.publishedAt === null ? t("status.draft") : t("status.published")}</td>
                      <td>{formatDate(row.updatedAt, DEFAULT_LOCALE)}</td>
                      <td className={styles.actions}>
                        <XStack gap="$2">
                          <Button
                            variant="outline"
                            label={t("edit")}
                            ariaLabel={t("editLabel", { title: row.title })}
                            busy={loadingId === row.id}
                            onPress={function edit() {
                              void openEdit(row);
                            }}
                          />
                          <Button
                            variant="ghost"
                            label={t("delete")}
                            ariaLabel={t("deleteLabel", { title: row.title })}
                            onPress={function askDelete() {
                              setPendingDelete(row);
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

      {form.open ? (
        <CollectionForm
          key={form.collection?.id ?? "new"}
          open
          collection={form.collection}
          onClose={closeForm}
          onChanged={applyChanged}
          onNotice={showNotice}
        />
      ) : null}

      <Dialog
        open={pendingDelete !== null}
        role="alertdialog"
        title={t("deleteTitle")}
        description={t("deleteBody")}
        onClose={function cancelDelete() {
          if (!deleting) setPendingDelete(null);
        }}
        testID="admin-delete-collection"
        actions={
          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button
              variant="ghost"
              label={t("cancel")}
              onPress={function cancel() {
                setPendingDelete(null);
              }}
            />
            <Button
              variant="destructive"
              label={t("deleteConfirm")}
              busy={deleting}
              onPress={function remove() {
                void confirmDelete();
              }}
            />
          </XStack>
        }
      >
        <Text kind="body">{pendingDelete?.title ?? ""}</Text>
      </Dialog>

      {notice ? (
        <Toast
          message={notice.message}
          tone={notice.tone}
          closeLabel={tAdmin("toastClose")}
          onClose={function dismiss() {
            setNotice(null);
          }}
          testID="admin-toast"
        />
      ) : null}
    </Column>
  );
}

CollectionsView.displayName = "CollectionsView";
