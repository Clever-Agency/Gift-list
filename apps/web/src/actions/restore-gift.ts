import "server-only";

import {
  giftCardSchema,
  giftRestoreSchema,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type ActionResult,
  type GiftCard,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { GiftStatusService } from "@/domain/gift-status";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { ownerGiftSelect } from "@/actions/gifts";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Gift not found",
};

function validation(field?: string): ActionResult<GiftCard> {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/**
 * Story 2.6: the owner returns an archived wish to the active list. The date is
 * replaced, including a clear. A day before the owner's today is refused and
 * nothing is written. A foreign or non-archived wish is `NOT_FOUND`.
 */
export async function restoreGift(
  headers: Headers,
  giftId: string,
  body: unknown,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = giftRestoreSchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  const owner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timeZone: true },
  });
  if (!owner) return unauthenticated;

  const outcome = await new GiftStatusService().restoreFromArchive({
    giftId,
    ownerId: session.user.id,
    expiresOn: parsed.data.expiresOn,
    timeZone: owner.timeZone,
  });
  if (outcome === "past") return validation("expiresOn");
  if (outcome === "missing") return notFound;

  const row = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId: session.user.id } },
    select: ownerGiftSelect,
  });
  if (!row) return notFound;

  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row, locale)) };
}
