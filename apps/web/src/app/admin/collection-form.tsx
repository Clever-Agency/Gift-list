"use client";

import { useState } from "react";
import { createTranslator } from "next-intl";
import {
  DEFAULT_LOCALE,
  type ActionResult,
  type EditorialCollectionAdminDetail,
  type EditorialCollectionAdminSummary,
  type EditorialItemAdmin,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import {
  Button,
  Close,
  Dialog,
  Heading,
  Switch,
  Text,
  TextField,
  XStack,
  YStack,
} from "@gift-list/ui";
import {
  createCollectionAction,
  createItemAction,
  deleteItemAction,
  publishCollectionAction,
  reorderItemsAction,
  unpublishCollectionAction,
  updateCollectionAction,
  updateItemAction,
} from "@/actions/editorial-admin";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.collections" });
const tAdmin = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export type NoticeTone = "success" | "error";

export type CollectionFormProps = {
  open: boolean;
  /** `null` opens the create form; a loaded collection opens the edit form. */
  collection: EditorialCollectionAdminDetail | null;
  onClose: () => void;
  /** The stored collection after every successful write (the row and the form state). */
  onChanged: (collection: EditorialCollectionAdminDetail) => void;
  onNotice: (message: string, tone: NoticeTone) => void;
};

type FieldErrors = Record<string, string | undefined>;

type ItemDraft = {
  id: string | null;
  title: string;
  description: string;
  linkUrl: string;
  imageUrl: string;
};

const EMPTY_DRAFT: ItemDraft = {
  id: null,
  title: "",
  description: "",
  linkUrl: "",
  imageUrl: "",
};

/** The collection as the form currently holds it, with a replaced publication stamp. */
function withSummary(
  collection: EditorialCollectionAdminDetail,
  summary: EditorialCollectionAdminSummary,
): EditorialCollectionAdminDetail {
  return {
    ...collection,
    title: summary.title,
    description: summary.description,
    coverImageUrl: summary.coverImageUrl,
    itemCount: summary.itemCount,
    publishedAt: summary.publishedAt,
    updatedAt: summary.updatedAt,
  };
}

/** A network failure of a server action is one calm sentence, not a stuck layer. */
async function safely<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

/** Moves one idea by `delta`; `null` when the move would leave the list. */
export function moveItem(
  items: readonly EditorialItemAdmin[],
  index: number,
  delta: number,
): EditorialItemAdmin[] | null {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return null;
  const next = [...items];
  const moved = next.splice(index, 1)[0];
  if (!moved) return null;
  next.splice(target, 0, moved);
  return next;
}

/**
 * Story 10.1: create/edit a collection and its ideas in one layer. The fields
 * are `packages/ui` controls; the layer is the shared `Dialog` in its `detail`
 * layout — the closest existing presentation to the right-side sheet of
 * `DESIGN.md` (the package has no side sheet, and a second one would duplicate
 * the layer contract). Esc, a scrim press and the cross close it; focus enters
 * and stays inside.
 *
 * Every write goes through a server action that checks the ADMIN role again.
 * The server answer replaces the local copy, so the form and the table never
 * guess what was stored. Item order is saved after every move.
 */
export function CollectionForm({
  open,
  collection,
  onClose,
  onChanged,
  onNotice,
}: CollectionFormProps) {
  const [collectionId, setCollectionId] = useState(collection?.id ?? null);
  const [title, setTitle] = useState(collection?.title ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(collection?.coverImageUrl ?? "");
  const [publishedAt, setPublishedAt] = useState(collection?.publishedAt ?? null);
  const [updatedAt, setUpdatedAt] = useState(collection?.updatedAt ?? new Date().toISOString());
  const [items, setItems] = useState<readonly EditorialItemAdmin[]>(collection?.items ?? []);
  const [collectionErrors, setCollectionErrors] = useState<FieldErrors>({});
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [itemErrors, setItemErrors] = useState<FieldErrors>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"collection" | "publish" | "item" | "order" | null>(null);

  const publishEmpty = t("publishEmpty");

  function currentDetail(): EditorialCollectionAdminDetail {
    return {
      id: collectionId ?? "",
      title,
      description: description.trim() === "" ? null : description,
      coverImageUrl: coverImageUrl.trim() === "" ? null : coverImageUrl,
      itemCount: items.length,
      publishedAt,
      updatedAt,
      items: [...items],
    };
  }

  function fieldError(field: string | undefined): string {
    if (field === "title") return t("error.title");
    if (field === "description") return t("error.description");
    if (field === "coverImageUrl" || field === "linkUrl" || field === "imageUrl") {
      return t("error.url");
    }
    if (field === "itemIds") return t("error.order");
    return t("error.generic");
  }

  async function saveCollection() {
    setBusy("collection");
    setCollectionErrors({});

    const input = { title, description, coverImageUrl };
    const result = await safely(function save() {
      return collectionId
        ? updateCollectionAction(collectionId, input)
        : createCollectionAction(input);
    });
    setBusy(null);

    if (result === null) {
      onNotice(t("error.generic"), "error");
      return;
    }

    if (!result.ok) {
      if (result.field) {
        setCollectionErrors({ [result.field]: fieldError(result.field) });
      } else {
        onNotice(t("error.generic"), "error");
      }
      return;
    }

    const created = collectionId === null;
    setCollectionId(result.data.id);
    setTitle(result.data.title);
    setDescription(result.data.description ?? "");
    setCoverImageUrl(result.data.coverImageUrl ?? "");
    setPublishedAt(result.data.publishedAt);
    setUpdatedAt(result.data.updatedAt);
    setItems(result.data.items);
    onChanged(result.data);
    onNotice(created ? t("toast.created") : t("toast.saved"), "success");
  }

  async function togglePublished(next: boolean) {
    if (collectionId === null) {
      onNotice(t("publishNeedSave"), "error");
      return;
    }
    if (next && items.length === 0) {
      setPublishError(publishEmpty);
      onNotice(publishEmpty, "error");
      return;
    }

    setPublishError(null);
    setBusy("publish");
    const result = await safely(function changePublication() {
      return next ? publishCollectionAction(collectionId) : unpublishCollectionAction(collectionId);
    });
    setBusy(null);

    if (result === null) {
      onNotice(t("error.generic"), "error");
      return;
    }

    if (!result.ok) {
      if (result.reason === "COLLECTION_EMPTY") {
        setPublishError(publishEmpty);
        onNotice(publishEmpty, "error");
      } else {
        onNotice(t("error.generic"), "error");
      }
      return;
    }

    const updated = withSummary(currentDetail(), result.data);
    setPublishedAt(updated.publishedAt);
    setUpdatedAt(updated.updatedAt);
    onChanged(updated);
    onNotice(next ? t("toast.published") : t("toast.unpublished"), "success");
  }

  async function submitItem() {
    if (collectionId === null) {
      onNotice(t("publishNeedSave"), "error");
      return;
    }

    setBusy("item");
    setItemErrors({});
    const input = {
      title: itemDraft.title,
      description: itemDraft.description,
      linkUrl: itemDraft.linkUrl,
      imageUrl: itemDraft.imageUrl,
    };
    const editingId = itemDraft.id;
    const result = await safely(function saveItem() {
      return editingId
        ? updateItemAction(collectionId, editingId, input)
        : createItemAction(collectionId, input);
    });
    setBusy(null);

    if (result === null) {
      onNotice(t("error.generic"), "error");
      return;
    }

    if (!result.ok) {
      if (result.field) {
        setItemErrors({ [result.field]: fieldError(result.field) });
      } else {
        onNotice(t("error.generic"), "error");
      }
      return;
    }

    setItems(result.data.items);
    setUpdatedAt(result.data.updatedAt);
    setPublishError(null);
    setItemDraft(EMPTY_DRAFT);
    onChanged(result.data);
    onNotice(editingId ? t("toast.itemSaved") : t("toast.itemAdded"), "success");
  }

  async function removeItem(item: EditorialItemAdmin) {
    if (collectionId === null) return;

    setBusy("item");
    const result = await safely(function remove() {
      return deleteItemAction(collectionId, item.id);
    });
    setBusy(null);

    if (result === null) {
      onNotice(t("error.generic"), "error");
      return;
    }

    if (!result.ok) {
      onNotice(t("error.generic"), "error");
      return;
    }

    setItems(result.data.items);
    setUpdatedAt(result.data.updatedAt);
    setPublishError(null);
    if (itemDraft.id === item.id) setItemDraft(EMPTY_DRAFT);
    onChanged(result.data);
    onNotice(t("toast.itemDeleted"), "success");
  }

  async function move(index: number, delta: number) {
    if (collectionId === null) return;

    const next = moveItem(items, index, delta);
    if (next === null) return;

    const previous = items;
    setItems(next);
    setBusy("order");
    const result = await safely(function reorder() {
      return reorderItemsAction(
        collectionId,
        next.map(function toId(item) {
          return item.id;
        }),
      );
    });
    setBusy(null);

    if (result === null) {
      setItems(previous);
      onNotice(t("error.generic"), "error");
      return;
    }

    if (!result.ok) {
      setItems(previous);
      onNotice(fieldError(result.field ?? "itemIds"), "error");
      return;
    }

    setItems(result.data.items);
    setUpdatedAt(result.data.updatedAt);
    onChanged(result.data);
    onNotice(t("toast.reordered"), "success");
  }

  function editItem(item: EditorialItemAdmin) {
    setItemErrors({});
    setItemDraft({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      linkUrl: item.linkUrl ?? "",
      imageUrl: item.imageUrl ?? "",
    });
  }

  function cancelItemEdit() {
    setItemErrors({});
    setItemDraft(EMPTY_DRAFT);
  }

  const editingItem = itemDraft.id !== null;

  return (
    <Dialog
      open={open}
      title={collectionId === null ? t("formCreateTitle") : t("formEditTitle")}
      onClose={onClose}
      closeAction={{ label: tAdmin("close"), icon: <Close size={20} /> }}
      layout="detail"
      testID="admin-collection-form"
      actions={
        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <Button variant="ghost" label={t("cancel")} onPress={onClose} />
          <Button label={t("save")} busy={busy === "collection"} onPress={saveCollection} />
        </XStack>
      }
    >
      <YStack gap="$4">
        <YStack gap="$3">
          <TextField
            label={t("fieldTitle")}
            value={title}
            onChangeText={setTitle}
            error={collectionErrors.title}
          />
          <TextField
            label={t("fieldDescription")}
            value={description}
            onChangeText={setDescription}
            multiline
            rows={4}
            error={collectionErrors.description}
          />
          <TextField
            label={t("fieldCover")}
            value={coverImageUrl}
            onChangeText={setCoverImageUrl}
            error={collectionErrors.coverImageUrl}
          />
        </YStack>

        <YStack gap="$3">
          <Heading level={3}>{t("itemsHeading")}</Heading>
          {items.length === 0 ? (
            <Text tone="muted">{t("itemsEmpty")}</Text>
          ) : (
            <YStack gap="$2">
              {items.map(function renderItem(item, index) {
                return (
                  <XStack
                    key={item.id}
                    gap="$2"
                    alignItems="center"
                    flexWrap="wrap"
                    paddingVertical="$2"
                    borderTopWidth={1}
                    borderColor="$border"
                  >
                    <Text kind="body-strong" flex={1} minWidth={120}>
                      {item.title}
                    </Text>
                    <Button
                      variant="outline"
                      label={t("itemUp")}
                      ariaLabel={t("itemUpLabel", { title: item.title })}
                      disabled={index === 0 || busy === "order"}
                      onPress={function moveUp() {
                        void move(index, -1);
                      }}
                    />
                    <Button
                      variant="outline"
                      label={t("itemDown")}
                      ariaLabel={t("itemDownLabel", { title: item.title })}
                      disabled={index === items.length - 1 || busy === "order"}
                      onPress={function moveDown() {
                        void move(index, 1);
                      }}
                    />
                    <Button
                      variant="ghost"
                      label={t("itemEdit")}
                      ariaLabel={t("itemEditLabel", { title: item.title })}
                      onPress={function startEdit() {
                        editItem(item);
                      }}
                    />
                    <Button
                      variant="ghost"
                      label={t("itemDelete")}
                      ariaLabel={t("itemDeleteLabel", { title: item.title })}
                      onPress={function remove() {
                        void removeItem(item);
                      }}
                    />
                  </XStack>
                );
              })}
            </YStack>
          )}

          {collectionId === null ? (
            <Text tone="muted">{t("publishNeedSave")}</Text>
          ) : (
            <YStack gap="$2">
              <Heading level={4}>{editingItem ? t("itemEdit") : t("itemAdd")}</Heading>
              <TextField
                label={t("itemFieldTitle")}
                value={itemDraft.title}
                onChangeText={function setItemTitle(value) {
                  setItemDraft({ ...itemDraft, title: value });
                }}
                error={itemErrors.title}
              />
              <TextField
                label={t("itemFieldDescription")}
                value={itemDraft.description}
                onChangeText={function setItemDescription(value) {
                  setItemDraft({ ...itemDraft, description: value });
                }}
                multiline
                rows={3}
                error={itemErrors.description}
              />
              <TextField
                label={t("itemFieldLink")}
                value={itemDraft.linkUrl}
                onChangeText={function setItemLink(value) {
                  setItemDraft({ ...itemDraft, linkUrl: value });
                }}
                hint={t("linkHint")}
                error={itemErrors.linkUrl}
              />
              <TextField
                label={t("itemFieldImage")}
                value={itemDraft.imageUrl}
                onChangeText={function setItemImage(value) {
                  setItemDraft({ ...itemDraft, imageUrl: value });
                }}
                error={itemErrors.imageUrl}
              />
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  variant="secondary"
                  label={editingItem ? t("itemSave") : t("itemAdd")}
                  busy={busy === "item"}
                  onPress={function saveItem() {
                    void submitItem();
                  }}
                />
                {editingItem ? (
                  <Button variant="ghost" label={t("itemCancel")} onPress={cancelItemEdit} />
                ) : null}
              </XStack>
            </YStack>
          )}
        </YStack>

        <YStack gap="$1">
          <Switch
            label={t("publishLabel")}
            hint={collectionId === null ? t("publishNeedSave") : t("publishHint")}
            checked={publishedAt !== null}
            disabled={collectionId === null || busy === "publish"}
            onChange={function changePublished(next) {
              void togglePublished(next);
            }}
            testID="admin-publish-switch"
          />
          {publishError ? (
            <Text kind="caption" tone="destructive" role="alert">
              {publishError}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </Dialog>
  );
}

CollectionForm.displayName = "CollectionForm";
