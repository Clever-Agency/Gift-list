import "server-only";

import {
  getMessages,
  negotiateLocale,
  notificationChangedFields,
  notificationDetails,
  notificationEmailSubject,
  notificationText,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Notification, NotificationKind, Prisma } from "@/db/generated/client";
import { getBrandName, getEnv } from "@/lib/env";
import { projectNotification, preferenceSelect, lockClosureGift } from "@/lib/notification-store";
import { escapeHtml } from "@/lib/password-reset-mail";
import { createUnsubscribeToken, type UnsubscribeType } from "@/lib/unsubscribe-token";

const MINUTE_MS = 60_000;
// Resend keeps a key for 24 hours. Leave a margin for the request in flight.
const RETRY_MS = 23 * 60 * MINUTE_MS;
const LEASE_MS = 5 * MINUTE_MS;

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend forwards these as letter headers (RFC 8058 needs the first two). */
  headers?: Record<string, string>;
};

type SendEmail = (message: Message, idempotencyKey: string) => Promise<"sent" | "already-sent">;

async function sendResendEmail(message: Message, idempotencyKey: string) {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Notification email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ ...message, from: env.EMAIL_FROM }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) return "sent" as const;
  if (response.status === 409) {
    const body = await response.json() as { name?: string };
    // Locale or privacy can change between attempts. With the stable key
    // Resend rejects a different body after accepting the previous one.
    if (body.name === "invalid_idempotent_request") return "already-sent" as const;
  }
  throw new Error(`Notification email provider returned ${response.status}`);
}

export function notificationEmailLink(baseUrl: string, id: string) {
  const url = new URL("/notifications", baseUrl);
  url.protocol = "https:";
  url.searchParams.set("id", id);
  return url.toString();
}

/**
 * CLE-137 (Story 7.2, FR-36): only the two date-reminder letters carry an
 * unsubscribe link and the RFC 8058 headers. A reservation letter keeps no
 * such control (R-3), so anything else answers `null`.
 */
export function notificationUnsubscribeType(kind: NotificationKind): UnsubscribeType | null {
  if (kind === "DATE_FRIEND") return "friendDates";
  if (kind === "DATE_OWN") return "ownList";
  return null;
}

function publicLetterUrl(baseUrl: string, path: string) {
  const url = new URL(path, baseUrl);
  url.protocol = "https:";
  return url.toString();
}

/**
 * The visible `/unsubscribe/{token}` page and its one-click POST receiver
 * (S4-3). The token grants that one reminder switch and nothing else.
 */
export function notificationUnsubscribeLinks(baseUrl: string, userId: string, kind: NotificationKind) {
  const type = notificationUnsubscribeType(kind);
  if (!type) return null;
  const path = `/unsubscribe/${encodeURIComponent(createUnsubscribeToken(userId, type))}`;
  return {
    type,
    page: publicLetterUrl(baseUrl, path),
    oneClick: publicLetterUrl(baseUrl, `${path}/one-click`),
  };
}

type Candidate = Pick<Notification, "id" | "kind" | "giftId" | "createdAt" | "emailFirstAttemptAt">;
const BATCH_SIZE = 50;

function availableAt(now: Date): Prisma.NotificationWhereInput {
  return {
    emailRequired: true,
    emailDoneAt: null,
    deliverAfter: { lte: now },
    OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: now } }],
  };
}

async function claimEmail(row: Candidate, clock: () => Date) {
  async function claim(db: Pick<Prisma.TransactionClient, "notification">, now = clock()) {
    if (row.emailFirstAttemptAt && now.getTime() - row.emailFirstAttemptAt.getTime() >= RETRY_MS) return null;
    const lease = new Date(now.getTime() + LEASE_MS);
    const result = await db.notification.updateMany({
      where: { ...availableAt(now), id: row.id, emailFirstAttemptAt: row.emailFirstAttemptAt },
      data: { emailFirstAttemptAt: row.emailFirstAttemptAt ?? now, emailLeaseUntil: lease },
    });
    return result.count === 1 ? lease : null;
  }

  if (row.kind !== "GIFT_CLOSED" || !row.giftId) return claim(prisma);
  const giftId = row.giftId;
  return prisma.$transaction(async function claimClosure(tx) {
    const { gift, now } = await lockClosureGift(tx, giftId);
    // A missing Gift may have been deleted after it was closed. Its durable
    // notification remains. Undo removes that notification under the same lock.
    if (gift && (gift.status !== "CLOSED" || gift.closedAt?.getTime() !== row.createdAt.getTime())) return null;
    return claim(tx, now);
  });
}

async function finishExpiredAttempts(now: Date, cutoff: Date) {
  const where: Prisma.NotificationWhereInput = {
    ...availableAt(now),
    emailFirstAttemptAt: { lte: cutoff },
  };
  const expired = await prisma.notification.findMany({
    where,
    select: { id: true },
    orderBy: [{ deliverAfter: "asc" }, { id: "asc" }],
    take: BATCH_SIZE,
  });
  if (!expired.length) return 0;
  const result = await prisma.notification.updateMany({
    where: { ...where, id: { in: expired.map(row => row.id) } },
    data: { emailDoneAt: now, emailLeaseUntil: null },
  });
  if (result.count > 0) console.error("notification-email: retry window expired", { count: result.count });
  return result.count;
}

export async function processNotificationEmails(
  now = new Date(),
  send: SendEmail = sendResendEmail,
  baseUrl = getEnv().BETTER_AUTH_URL,
) {
  const startedAt = Date.now();
  function clock() {
    return new Date(now.getTime() + Date.now() - startedAt);
  }
  const cutoff = new Date(now.getTime() - RETRY_MS);
  const expired = await finishExpiredAttempts(now, cutoff);
  const rows = await prisma.notification.findMany({
    where: {
      AND: [
        availableAt(now),
        { OR: [{ emailFirstAttemptAt: null }, { emailFirstAttemptAt: { gt: cutoff } }] },
      ],
    },
    select: { id: true, kind: true, giftId: true, createdAt: true, emailFirstAttemptAt: true },
    orderBy: [{ deliverAfter: "asc" }, { id: "asc" }],
    take: BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (Date.now() - startedAt > 45_000) break;
    try {
      const lease = await claimEmail(row, clock);
      if (!lease) continue;
      const current = await prisma.notification.findUnique({
        where: { id: row.id, emailLeaseUntil: lease },
        include: { recipient: { select: { email: true, locale: true, ...preferenceSelect } } },
      });
      if (!current) continue;
      const item = await projectNotification(current, current.recipient, "email", clock());
      if (item && item.event.kind !== "UNKNOWN") {
        const locale = negotiateLocale([current.recipient.locale]);
        const copy = getMessages(locale).notifications;
        // Story 7.3 (FR-34): a birthday letter leads to the Friend's profile,
        // not to the notification page; every other letter keeps its link.
        const href = item.event.kind === "DATE_FRIEND" && item.href !== null
          ? publicLetterUrl(baseUrl, item.href)
          : notificationEmailLink(baseUrl, item.id);
        const openLabel = item.event.kind === "DATE_FRIEND" && item.href !== null
          ? copy.openFriend
          : copy.open;
        const firstLine = notificationText(item.event, locale);
        // CLE-124/D-49: no line names the holder to the owner; the projection
        // already drops a legacy `holderName` from the payload.
        const lines = [
          firstLine,
          notificationChangedFields(item.event, locale),
          ...notificationDetails(item.event, locale),
        ].filter(line => line !== null);
        // Projection may take time. Keep the last outbound request inside the
        // provider's key lifetime even on a delayed or resumed worker.
        if (current.emailFirstAttemptAt && clock().getTime() - current.emailFirstAttemptAt.getTime() >= RETRY_MS) continue;
        // CLE-137 (Story 7.2): a date reminder offers «Отписаться» and the
        // RFC 8058 headers; every other letter stays as it was (R-3).
        const unsubscribe = notificationUnsubscribeLinks(baseUrl, current.recipientId, row.kind);
        await send({
          to: current.recipient.email,
          subject: notificationEmailSubject(item.event, locale).replace("{brand}", getBrandName()),
          text: [
            ...lines,
            "",
            href,
            ...(unsubscribe ? ["", `${copy.unsubscribe}: ${unsubscribe.page}`] : []),
          ].join("\n"),
          html: `${lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}<p><a href="${escapeHtml(href)}">${escapeHtml(openLabel)}</a></p>` +
            (unsubscribe
              ? `<p><a href="${escapeHtml(unsubscribe.page)}">${escapeHtml(copy.unsubscribe)}</a></p>`
              : ""),
          headers: unsubscribe
            ? {
              "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
            : undefined,
        }, `notification/${item.id}`);
        sent++;
      }
      await prisma.notification.updateMany({
        where: { id: row.id, emailLeaseUntil: lease },
        data: { emailDoneAt: clock(), emailLeaseUntil: null },
      });
    } catch (error) {
      failed++;
      console.error("notification-email: delivery failed", error instanceof Error ? error.name : "unknown");
    }
  }
  return { sent, failed, expired };
}
