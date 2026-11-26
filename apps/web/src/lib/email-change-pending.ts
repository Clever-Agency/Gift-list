import "server-only";

import { prisma } from "@/db/client";
import { sendEmailChangedNotice } from "@/lib/email-change-mail";

/**
 * CLE-129/T9.1 (FR-56, AD-3): the memory of a requested email change.
 *
 * Better Auth builds the one-time link itself and applies the change inside
 * `/verify-email`; at that point its update hook sees only the **new** address,
 * so the old one would be lost. The request therefore leaves a short-lived row
 * in the existing `Verification` table (no new table): identifier
 * `change-email:<userId>`, value `{ oldEmail, newEmail, locale }`. After the
 * apply, `notifyPreviousEmailAfterChange` finds the row, matches the committed
 * address and sends the notice to the old one. A change that never happened
 * leaves nothing on the old address; the row simply expires.
 */
export const EMAIL_CHANGE_PENDING_PREFIX = "change-email:";

/** The link lives one hour, the same `expiresIn` that `lib/auth.ts` gives Better Auth. */
export const EMAIL_CHANGE_LINK_TTL_SECONDS = 60 * 60;

type PendingEmailChange = {
  oldEmail: string;
  newEmail: string;
  locale: string | null;
};

/** The two addresses a Better Auth email-change link carries (T9.2a). */
export type EmailChangeLinkClaim = {
  oldEmail: string;
  newEmail: string;
};

function pendingIdentifier(userId: string): string {
  return `${EMAIL_CHANGE_PENDING_PREFIX}${userId}`;
}

function parsePending(value: string): PendingEmailChange | null {
  try {
    const parsed = JSON.parse(value) as Partial<PendingEmailChange> | null;
    if (
      parsed === null ||
      typeof parsed.oldEmail !== "string" ||
      typeof parsed.newEmail !== "string"
    ) {
      return null;
    }
    return {
      oldEmail: parsed.oldEmail,
      newEmail: parsed.newEmail,
      locale: typeof parsed.locale === "string" ? parsed.locale : null,
    };
  } catch {
    return null;
  }
}

/**
 * Stores the address the user is leaving and the one they asked for. A repeat
 * request replaces the previous row, so only the latest address can be
 * confirmed and only its old address is notified.
 */
export async function rememberEmailChangeRequest(input: {
  userId: string;
  oldEmail: string;
  newEmail: string;
  locale: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const identifier = pendingIdentifier(input.userId);
  const value = JSON.stringify({
    oldEmail: input.oldEmail,
    newEmail: input.newEmail,
    locale: input.locale,
  });
  await prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.verification.create({
      data: {
        identifier,
        value,
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_LINK_TTL_SECONDS * 1000),
      },
    }),
  ]);
}

/**
 * CLE-129/T9.2: the user cancelled the request on the screen, so the old address
 * is no longer expected to be notified and the memory of the wish is dropped.
 * The one-time link itself is a signed token Better Auth cannot revoke, but
 * `email-change-verify.ts` refuses it once this row is gone (T9.2a), so a
 * cancelled request never changes the address even if the letter is opened.
 */
export async function forgetEmailChangeRequest(userId: string): Promise<void> {
  await prisma.verification.deleteMany({ where: { identifier: pendingIdentifier(userId) } });
}

/**
 * CLE-129/T9.2a: reads the two addresses out of a Better Auth verification JWT
 * **without** checking its signature. The `/verify-email` handler verifies the
 * token itself; this reading only decides whether the change is still expected,
 * and a signed-out or forged payload that fails the signature never changes
 * anything either way. A payload without `updateTo` is a plain address
 * verification, not a change, so it returns null.
 */
export function readEmailChangeLinkClaim(token: string): EmailChangeLinkClaim | null {
  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload === null || typeof payload !== "object") return null;
  const { email, updateTo } = payload as { email?: unknown; updateTo?: unknown };
  if (typeof email !== "string" || typeof updateTo !== "string" || updateTo.trim() === "") {
    return null;
  }
  return { oldEmail: email.toLowerCase(), newEmail: updateTo.toLowerCase() };
}

/**
 * CLE-129/T9.2a: the pending row is the source of truth for a link that is
 * already in somebody's mailbox. The link only proves the address was reachable
 * when the request was made; the row says the request is still wanted and still
 * points at **this** address. A cancel removes the row, and a newer request
 * replaces it, so both the cancelled and the superseded link are refused.
 */
export async function isEmailChangeLinkStillPending(
  claim: EmailChangeLinkClaim,
): Promise<boolean> {
  const owner = await prisma.user.findFirst({
    where: { email: { equals: claim.oldEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (!owner) return false;
  const identifier = pendingIdentifier(owner.id);
  const row = await prisma.verification.findFirst({ where: { identifier } });
  if (!row) return false;
  const pending = parsePending(row.value);
  return (
    pending !== null &&
    pending.oldEmail.toLowerCase() === claim.oldEmail &&
    pending.newEmail.toLowerCase() === claim.newEmail
  );
}

/**
 * Called from Better Auth's `databaseHooks.user.update.after`, which runs for
 * every user write. Only a committed change with a matching pending row sends
 * the notice; a profile or session-only update finds nothing to do.
 */
export async function notifyPreviousEmailAfterChange(user: {
  id: string;
  email: string;
}): Promise<void> {
  const identifier = pendingIdentifier(user.id);
  const row = await prisma.verification.findFirst({ where: { identifier } });
  if (!row) return;
  const pending = parsePending(row.value);
  if (pending === null || pending.newEmail.toLowerCase() !== user.email.toLowerCase()) return;
  await sendEmailChangedNotice({
    to: pending.oldEmail,
    locale: pending.locale,
    newEmail: user.email,
  });
  await prisma.verification.deleteMany({ where: { identifier } });
}
