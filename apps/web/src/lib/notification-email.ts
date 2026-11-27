import "server-only";

import { createHash } from "node:crypto";
import {
  formatDate,
  getMessages,
  negotiateLocale,
  notificationChangedFields,
  notificationDetails,
  notificationEmailSubject,
  notificationText,
  type Messages,
  type NotificationItem,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
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
  // Story 7.6: a personal date is unsubscribed by the same switch as a birthday.
  if (kind === "DATE_FRIEND" || kind === "DATE_CUSTOM") return "friendDates";
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

type Candidate = Pick<
  Notification, "id" | "recipientId" | "kind" | "giftId" | "createdAt" | "emailFirstAttemptAt"
>;
const BATCH_SIZE = 50;

/** Story 7.3/7.6: the date-reminder kinds share one letter when they land together. */
function isDateReminder(kind: NotificationKind) {
  return kind === "DATE_FRIEND" || kind === "DATE_OWN" || kind === "DATE_CUSTOM";
}

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

async function loadEmailRow(row: Candidate, lease: Date) {
  return prisma.notification.findUnique({
    where: { id: row.id, emailLeaseUntil: lease },
    include: { recipient: { select: { email: true, locale: true, ...preferenceSelect } } },
  });
}

type EmailRow = NonNullable<Awaited<ReturnType<typeof loadEmailRow>>>;

type Clock = () => Date;

async function retireEmail(rowId: string, lease: Date, clock: Clock) {
  await prisma.notification.updateMany({
    where: { id: rowId, emailLeaseUntil: lease },
    data: { emailDoneAt: clock(), emailLeaseUntil: null },
  });
}

/**
 * Story 7.3 (FR-34): a birthday letter leads to the Friend's profile.
 * Story 7.4 (FR-35): the owner's own reminder leads to «Мой вишлист» at the
 * site root (`https://{домен}/`); without App Links on `/` it opens in the
 * browser as the web build of the same screen. Every other letter keeps its
 * link.
 */
function reminderLetterTarget(item: NotificationItem, baseUrl: string, copy: Messages["notifications"]) {
  if ((item.event.kind === "DATE_FRIEND" || item.event.kind === "DATE_CUSTOM") && item.href !== null) {
    return { href: publicLetterUrl(baseUrl, item.href), label: copy.openFriend };
  }
  if (item.event.kind === "DATE_OWN") {
    return { href: publicLetterUrl(baseUrl, item.href ?? "/"), label: copy.openOwnList };
  }
  return { href: notificationEmailLink(baseUrl, item.id), label: copy.open };
}

/**
 * Story 7.6 (FR-38): a personal date names the Friend, the owner's label and
 * the day in the letter subject. The subject lives in the letter catalog only
 * (`getWebMessages`), so the app bundle never pays for it; every other kind
 * keeps the shared subject from the client catalog.
 */
export function letterSubject(event: NotificationItem["event"], locale: string): string {
  if (event.kind !== "DATE_CUSTOM") return notificationEmailSubject(event, locale);
  return getWebMessages(locale).email.notificationDateCustomSubject
    .replace("{person}", event.personName)
    .replace("{dateTitle}", event.dateTitle)
    .replace("{date}", formatDate(event.date, locale, { year: false }));
}

/**
 * One letter about one notification: the ordinary queue path and the digest
 * of a single reminder share it.
 */
function notificationLetter(current: EmailRow, item: NotificationItem, baseUrl: string): Message {
  const locale = negotiateLocale([current.recipient.locale]);
  const copy = getMessages(locale).notifications;
  const { href, label: openLabel } = reminderLetterTarget(item, baseUrl, copy);
  // CLE-124/D-49: no line names the holder to the owner; the projection
  // already drops a legacy `holderName` from the payload.
  const lines = [
    notificationText(item.event, locale),
    notificationChangedFields(item.event, locale),
    ...notificationDetails(item.event, locale),
  ].filter(line => line !== null);
  // CLE-137 (Story 7.2): a date reminder offers «Отписаться» and the RFC 8058
  // headers; every other letter stays as it was (R-3).
  const unsubscribe = notificationUnsubscribeLinks(baseUrl, current.recipientId, current.kind);
  return {
    to: current.recipient.email,
    subject: letterSubject(item.event, locale).replace("{brand}", getBrandName()),
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
  };
}

type DigestEntry = { current: EmailRow; item: NotificationItem; lease: Date };

/**
 * Story 7.3 (FR-34): several reminders of one recipient become one letter.
 * Each entry keeps its own line, link and summary; the RFC 8058 header names
 * the birthday list when both reminder types share the digest.
 */
function digestLetter(entries: DigestEntry[], baseUrl: string): Message {
  const first = entries[0]!.current;
  const locale = negotiateLocale([first.recipient.locale]);
  const copy = getMessages(locale).notifications;
  const blocks = entries.map(function letterBlock(entry) {
    const lines = [
      notificationText(entry.item.event, locale),
      notificationChangedFields(entry.item.event, locale),
      ...notificationDetails(entry.item.event, locale),
    ].filter((line): line is string => line !== null);
    const { href, label } = reminderLetterTarget(entry.item, baseUrl, copy);
    return { lines, href, label };
  });
  const kinds = new Set(entries.map(entry => entry.item.event.kind));
  // Story 7.6: a personal date shares the birthday unsubscribe switch.
  const friendDates = kinds.has("DATE_FRIEND") || kinds.has("DATE_CUSTOM")
    ? notificationUnsubscribeLinks(baseUrl, first.recipientId, "DATE_FRIEND")
    : null;
  const ownList = kinds.has("DATE_OWN")
    ? notificationUnsubscribeLinks(baseUrl, first.recipientId, "DATE_OWN")
    : null;
  // One header target: the birthday list is the main reason for the reminder.
  const primary = friendDates ?? ownList;
  const unsubscribeLines = [
    ...(friendDates ? [`${copy.unsubscribeFriendDates}: ${friendDates.page}`] : []),
    ...(ownList ? [`${copy.unsubscribeOwnList}: ${ownList.page}`] : []),
  ];
  const unsubscribeHtml = [
    ...(friendDates
      ? [`<p><a href="${escapeHtml(friendDates.page)}">${escapeHtml(copy.unsubscribeFriendDates)}</a></p>`]
      : []),
    ...(ownList
      ? [`<p><a href="${escapeHtml(ownList.page)}">${escapeHtml(copy.unsubscribeOwnList)}</a></p>`]
      : []),
  ].join("");
  const text = blocks
    .map(block => [...block.lines, block.href].join("\n"))
    .join("\n\n");
  return {
    to: first.recipient.email,
    subject: copy.emailSubjectDateDigest.replace("{brand}", getBrandName()),
    text: unsubscribeLines.length ? `${text}\n\n${unsubscribeLines.join("\n")}` : text,
    html: blocks
      .map(block => `${block.lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}` +
        `<p><a href="${escapeHtml(block.href)}">${escapeHtml(block.label)}</a></p>`)
      .join("") + unsubscribeHtml,
    headers: primary
      ? {
        "List-Unsubscribe": `<${primary.oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
      : undefined,
  };
}

/**
 * Story 7.3 (FR-34): all pending date reminders of one recipient leave as one
 * letter. Every row the digest carries is marked sent together; a failed send
 * marks none, so the next run retries the same set under the same key.
 */
async function processDateReminders(
  group: Candidate[],
  clock: Clock,
  send: SendEmail,
  baseUrl: string,
) {
  const claimed: { row: Candidate; lease: Date }[] = [];
  for (const member of group) {
    const lease = await claimEmail(member, clock);
    if (lease) claimed.push({ row: member, lease });
  }
  if (!claimed.length) return { sent: 0 };

  const entries: DigestEntry[] = [];
  for (const { row, lease } of claimed) {
    const current = await loadEmailRow(row, lease);
    if (!current) continue;
    const item = await projectNotification(current, current.recipient, "email", clock());
    // A reminder the recipient may no longer see is retired like a single one.
    if (!item || item.event.kind === "UNKNOWN") {
      await retireEmail(row.id, lease, clock);
      continue;
    }
    // Projection may take time. Keep the last outbound request inside the
    // provider's key lifetime even on a delayed or resumed worker.
    if (current.emailFirstAttemptAt &&
      clock().getTime() - current.emailFirstAttemptAt.getTime() >= RETRY_MS) continue;
    entries.push({ current, item, lease });
  }
  if (!entries.length) return { sent: 0 };

  const ids = entries.map(entry => entry.current.id).sort();
  if (entries.length === 1) {
    const entry = entries[0]!;
    await send(notificationLetter(entry.current, entry.item, baseUrl), `notification/${ids[0]}`);
  } else {
    // The key covers the exact set: a retry after a failed mark replays the
    // same letter, while a reminder added later starts a new one.
    const key = createHash("sha256").update(ids.join(",")).digest("hex");
    await send(digestLetter(entries, baseUrl), `notification-digest/${key}`);
  }
  for (const entry of entries) await retireEmail(entry.current.id, entry.lease, clock);
  return { sent: 1 };
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
    select: {
      id: true, recipientId: true, kind: true, giftId: true, createdAt: true, emailFirstAttemptAt: true,
    },
    orderBy: [{ deliverAfter: "asc" }, { id: "asc" }],
    take: BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;
  const handled = new Set<string>();
  for (const row of rows) {
    if (handled.has(row.id)) continue;
    if (Date.now() - startedAt > 45_000) break;
    try {
      if (isDateReminder(row.kind)) {
        const group = rows.filter(candidate => !handled.has(candidate.id) &&
          candidate.recipientId === row.recipientId && isDateReminder(candidate.kind));
        for (const member of group) handled.add(member.id);
        sent += (await processDateReminders(group, clock, send, baseUrl)).sent;
        continue;
      }
      const lease = await claimEmail(row, clock);
      if (!lease) continue;
      const current = await loadEmailRow(row, lease);
      if (!current) continue;
      const item = await projectNotification(current, current.recipient, "email", clock());
      if (item && item.event.kind !== "UNKNOWN") {
        // Projection may take time. Keep the last outbound request inside the
        // provider's key lifetime even on a delayed or resumed worker.
        if (current.emailFirstAttemptAt && clock().getTime() - current.emailFirstAttemptAt.getTime() >= RETRY_MS) continue;
        await send(notificationLetter(current, item, baseUrl), `notification/${item.id}`);
        sent++;
      }
      await retireEmail(row.id, lease, clock);
    } catch (error) {
      failed++;
      console.error("notification-email: delivery failed", error instanceof Error ? error.name : "unknown");
    }
  }
  return { sent, failed, expired };
}
