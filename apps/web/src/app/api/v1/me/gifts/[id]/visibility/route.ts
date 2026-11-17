import { giftVisibilityPreviewQuerySchema } from "@gift-list/contracts";

import { previewGiftVisibility } from "@/actions/gifts";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * CLE-82/S23.2 (FR-10 ред. 2026-11-11): preflight of a visibility change on the
 * owner's wish. `GET .../visibility?visibility=FRIENDS` answers
 * `{ wouldCancelReservation }` in the AD-12 envelope and writes nothing. The
 * client shows the confirm «Бронирующий потеряет доступ, бронь снимется» only
 * when the flag is true; the PATCH repeats the same AD-7 rule on its own, so a
 * stale answer can never skip the release or release a kept reservation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = giftVisibilityPreviewQuerySchema.safeParse({
    visibility: new URL(request.url).searchParams.get("visibility"),
  });
  if (!parsed.success) {
    return toResponse({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: firstIssueField(parsed.error),
    });
  }

  return toResponse(await previewGiftVisibility(request.headers, id, parsed.data.visibility));
}

/** The preflight is a read; every other method keeps the AD-12 NOT_FOUND envelope. */
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
