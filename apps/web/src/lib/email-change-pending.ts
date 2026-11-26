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
 * The one-time link itself is a signed token Better Auth cannot revoke; it still
 * expires in an hour and works once.
 */
export async function forgetEmailChangeRequest(userId: string): Promise<void> {
  await prisma.verification.deleteMany({ where: { identifier: pendingIdentifier(userId) } });
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
