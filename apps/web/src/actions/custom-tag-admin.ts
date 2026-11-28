"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  customTagApprovalSchema,
  customTagRejectionSchema,
  type ActionResult,
  type ErrorReason,
} from "@gift-list/contracts";
import { requireAdmin } from "@/lib/admin";
import { firstIssueField } from "@/lib/api-v1";
import { approveCustomTag, rejectCustomTag } from "@/lib/custom-tag-store";

/**
 * Story 10.2 / AD-22: the server actions of `/admin/tags`. As on `/admin`, every
 * action checks the ADMIN role itself through {@link requireAdmin}: the page gate
 * protects the screen only, while a Server Function can be called by a direct POST
 * (Next docs, «Server Functions are reachable via direct POST requests»). A
 * refusal is the same closed `NOT_FOUND` for anonymous and USER alike.
 *
 * The contract validates the body before the store, so a malformed call answers
 * `VALIDATION` with the first field instead of a database error. The store
 * outcomes become the AD-12 envelope: a decided text and a taken slug are
 * `CONFLICT` with their new reasons, a vanished catalog tag is `VALIDATION` with
 * `field: "tagId"`.
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

function conflict(reason: ErrorReason, field?: string): AdminFailure {
  return {
    ok: false,
    code: "CONFLICT",
    message: "Conflict",
    reason,
    ...(field ? { field } : {}),
  };
}

async function isAdmin(): Promise<boolean> {
  const gate = await requireAdmin(await headers());
  return gate.ok;
}

/** What the screen needs to take the line out of the queue after an approval. */
export type CustomTagApprovalResult = {
  /** The queue key as the moderator saw it. */
  readonly normalizedText: string;
  readonly tagId: string;
  /** How many `GiftTag` rows were linked to the catalog tag. */
  readonly linkedTags: number;
};

/**
 * Story 10.2: approve one queue line into a new catalog tag or an existing one.
 * `revalidatePath` refreshes the Server Component table after the write, while the
 * screen also drops the line locally from the answer.
 */
export async function approveCustomTagAction(
  input: unknown,
): Promise<ActionResult<CustomTagApprovalResult>> {
  if (!(await isAdmin())) return refused;

  const parsed = customTagApprovalSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const result = await approveCustomTag(parsed.data);
  if (!result.ok) {
    if (result.reason === "ALREADY_DECIDED") return conflict("CUSTOM_TAG_DECIDED");
    if (result.reason === "SLUG_TAKEN") return conflict("CUSTOM_TAG_SLUG_TAKEN", "slug");
    if (result.reason === "TAG_MISSING") return invalid("tagId", "CATALOG_TAG_MISSING");
    return invalid("normalizedText");
  }

  revalidatePath("/admin/tags");
  return {
    ok: true,
    data: {
      normalizedText: parsed.data.normalizedText,
      tagId: result.tagId,
      linkedTags: result.linkedTags,
    },
  };
}

/** What the screen needs to take the line out of the queue after a rejection. */
export type CustomTagRejectionResult = {
  /** The queue key as the moderator saw it. */
  readonly normalizedText: string;
};

/**
 * Story 10.2: reject one queue line. Only the decision row is written; the wishes
 * keep their text as a caption and stay out of aggregates (the store owns that
 * rule). A repeated decision is a `CONFLICT`, not a silent overwrite.
 */
export async function rejectCustomTagAction(
  input: unknown,
): Promise<ActionResult<CustomTagRejectionResult>> {
  if (!(await isAdmin())) return refused;

  const parsed = customTagRejectionSchema.safeParse(input);
  if (!parsed.success) return invalid(firstIssueField(parsed.error));

  const result = await rejectCustomTag(parsed.data.normalizedText);
  if (!result.ok) {
    return result.reason === "ALREADY_DECIDED"
      ? conflict("CUSTOM_TAG_DECIDED")
      : invalid("normalizedText");
  }

  revalidatePath("/admin/tags");
  return { ok: true, data: { normalizedText: parsed.data.normalizedText } };
}
