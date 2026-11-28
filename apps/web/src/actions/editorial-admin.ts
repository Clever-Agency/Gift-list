"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  editorialCollectionInputSchema,
  editorialItemInputSchema,
  editorialItemOrderSchema,
  type ActionResult,
  type EditorialCollectionAdminDetail,
  type EditorialCollectionAdminSummary,
  type ErrorReason,
} from "@gift-list/contracts";
import { requireAdmin } from "@/lib/admin";
import { firstIssueField } from "@/lib/api-v1";
import {
  createEditorialCollection,
  createEditorialItem,
  deleteEditorialCollection,
  deleteEditorialItem,
  getEditorialCollectionForAdmin,
  publishEditorialCollection,
  reorderEditorialItems,
  unpublishEditorialCollection,
  updateEditorialCollection,
  updateEditorialItem,
} from "@/lib/editorial-store";

/**
 * Story 10.1 / AD-22: the server actions of `/admin`. Every action checks the
 * ADMIN role itself through {@link requireAdmin} — the page gate protects the
 * screen only, while an action can be called by a direct POST (Next docs,
 * «Server Functions are reachable via direct POST requests»). A refusal is the
 * same closed `NOT_FOUND` for anonymous, USER and an unknown id, so the panel
 * never reveals whether `/admin` or a collection exists.
 *
 * The contract runs validation before the store: a malformed body answers
 * `VALIDATION` with the first field, never a database error. `revalidatePath`
 * refreshes the Server Component table after a write, while the client keeps
 * its own copy of the answer so the dialog does not flicker.
 */
type AdminFailure = Extract<ActionResult<never>, { ok: false }>;

const refused: AdminFailure = { ok: false, code: "NOT_FOUND", message: "Not found" };

function invalid(field?: string, reason?: ErrorReason): AdminFailure {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
    ...(reason ? { reason } : {}),
  };
}

async function isAdmin(): Promise<boolean> {
  const gate = await requireAdmin(await headers());
  return gate.ok;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function loadCollectionAction(
  id: string,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(id)) return refused;

  const collection = await getEditorialCollectionForAdmin(id);
  if (collection === null) return refused;
  return { ok: true, data: collection };
}

export async function createCollectionAction(
  input: unknown,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin())) return refused;

  const parsed = editorialCollectionInputSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const data = await createEditorialCollection(parsed.data);
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function updateCollectionAction(
  id: string,
  input: unknown,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(id)) return refused;

  const parsed = editorialCollectionInputSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const data = await updateEditorialCollection(id, parsed.data);
  if (data === null) return refused;
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function deleteCollectionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!(await isAdmin()) || !isId(id)) return refused;

  const removed = await deleteEditorialCollection(id);
  if (!removed) return refused;
  revalidatePath("/admin");
  return { ok: true, data: { id } };
}

export async function publishCollectionAction(
  id: string,
): Promise<ActionResult<EditorialCollectionAdminSummary>> {
  if (!(await isAdmin()) || !isId(id)) return refused;

  const result = await publishEditorialCollection(id);
  if (!result.ok) {
    return result.reason === "empty" ? invalid(undefined, "COLLECTION_EMPTY") : refused;
  }
  revalidatePath("/admin");
  return { ok: true, data: result.data };
}

export async function unpublishCollectionAction(
  id: string,
): Promise<ActionResult<EditorialCollectionAdminSummary>> {
  if (!(await isAdmin()) || !isId(id)) return refused;

  const data = await unpublishEditorialCollection(id);
  if (data === null) return refused;
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function createItemAction(
  collectionId: string,
  input: unknown,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(collectionId)) return refused;

  const parsed = editorialItemInputSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const data = await createEditorialItem(collectionId, parsed.data);
  if (data === null) return refused;
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function updateItemAction(
  collectionId: string,
  itemId: string,
  input: unknown,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(collectionId) || !isId(itemId)) return refused;

  const parsed = editorialItemInputSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const data = await updateEditorialItem(collectionId, itemId, parsed.data);
  if (data === null) return refused;
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function deleteItemAction(
  collectionId: string,
  itemId: string,
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(collectionId) || !isId(itemId)) return refused;

  const removed = await deleteEditorialItem(collectionId, itemId);
  if (!removed) return refused;

  const data = await getEditorialCollectionForAdmin(collectionId);
  if (data === null) return refused;
  revalidatePath("/admin");
  return { ok: true, data };
}

export async function reorderItemsAction(
  collectionId: string,
  itemIds: readonly string[],
): Promise<ActionResult<EditorialCollectionAdminDetail>> {
  if (!(await isAdmin()) || !isId(collectionId)) return refused;

  const parsed = editorialItemOrderSchema.safeParse({ itemIds });
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const result = await reorderEditorialItems(collectionId, parsed.data.itemIds);
  if (!result.ok) {
    return result.reason === "order" ? invalid("itemIds") : refused;
  }
  revalidatePath("/admin");
  return { ok: true, data: result.data };
}
