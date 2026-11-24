import "server-only";

import { getMessages, negotiateLocale, notificationChangedFields, notificationText } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Notification, Prisma } from "@/db/generated/client";
import { getBrandName, getEnv } from "@/lib/env";
import { projectNotification, preferenceSelect, lockClosureGift } from "@/lib/notification-store";
import { escapeHtml } from "@/lib/password-reset-mail";

const MINUTE_MS = 60_000;
// Resend keeps a key for 24 hours. Leave a margin for the request in flight.
const RETRY_MS = 23 * 60 * MINUTE_MS;
const LEASE_MS = 5 * MINUTE_MS;

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
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
        const href = notificationEmailLink(baseUrl, item.id);
        const firstLine = item.event.kind === "RESERVATION_OWNER_ASK" && !item.event.actionable
          ? copy.stale
          : notificationText(item.event, locale);
        const holder = "holderName" in item.event && item.event.holderName
          ? copy.holder.replace("{name}", item.event.holderName)
          : null;
        const lines = [firstLine, holder, notificationChangedFields(item.event, locale)]
          .filter(line => line !== null);
        // Projection may take time. Keep the last outbound request inside the
        // provider's key lifetime even on a delayed or resumed worker.
        if (current.emailFirstAttemptAt && clock().getTime() - current.emailFirstAttemptAt.getTime() >= RETRY_MS) continue;
        await send({
          to: current.recipient.email,
          subject: copy.emailSubject.replace("{brand}", getBrandName()),
          text: [...lines, "", href].join("\n"),
          html: `${lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}<p><a href="${escapeHtml(href)}">${escapeHtml(copy.open)}</a></p>`,
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
