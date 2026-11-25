import "server-only";

import {
  notificationPayloadSchema,
  type NotificationFeed,
  type NotificationItem,
  type NotificationPreferences,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Notification, NotificationKind, Prisma } from "@/db/generated/client";
import type { GiftEditEventField } from "@/domain/gift-edit";
import { UNDO_WINDOW_MS } from "@/domain/gift-status";
import { VisibilityPolicy } from "@/domain/visibility";
import { relationshipReader } from "@/lib/relationships";
import { canonicalTimeZone } from "@/lib/time-zone";

type Tx = Prisma.TransactionClient;
type GiftEventKind = Exclude<NotificationKind,
  "FRIEND_INVITE" | "FRIEND_ACCEPT" | "FRIEND_REJECT" | "DATE_FRIEND" | "DATE_OWN" | "SUGGESTION">;

const giftSelect = {
  id: true,
  title: true,
  archivedAt: true,
  visibility: true,
  status: true,
  reservedAt: true,
  reservedById: true,
  reservationPhase: true,
  reservationPhaseAt: true,
  reservationBought: true,
  reservationDueAt: true,
  reservationTimeZone: true,
  titleSnapshotOnReserve: true,
  list: { select: { ownerId: true, owner: { select: { nick: true } } } },
} satisfies Prisma.GiftSelect;

type GiftSnapshot = Prisma.GiftGetPayload<{ select: typeof giftSelect }>;

export const preferenceSelect = {
  datesInApp: true,
  datesEmail: true,
  wishExpiryInApp: true,
  wishExpiryEmail: true,
} satisfies Prisma.UserSelect;

export function notificationGiftSnapshot(db: Pick<Tx, "gift">, id: string) {
  return db.gift.findUnique({ where: { id }, select: giftSelect });
}

export async function enqueueNotification(tx: Tx, data: Prisma.NotificationCreateManyInput) {
  await tx.notification.createMany({ data, skipDuplicates: true });
}

export async function enqueueFriendNotification(
  tx: Tx,
  kind: "FRIEND_INVITE" | "FRIEND_ACCEPT" | "FRIEND_REJECT",
  eventId: string,
  actorId: string,
  recipientId: string,
  at = new Date(),
) {
  await enqueueNotification(tx, {
    eventKey: `${kind}:${eventId}`,
    kind,
    actorId,
    recipientId,
    createdAt: at,
    deliverAfter: at,
    payload: {},
  });
}

type GiftNotification = {
  kind: GiftEventKind;
  role: "owner" | "holder";
  email: boolean;
  at: Date;
  fields?: readonly GiftEditEventField[];
};

function giftEventKey(kind: GiftEventKind, giftId: string, at: Date) {
  return `${kind}:${giftId}:${at.toISOString()}`;
}

export async function enqueueGiftNotification(
  tx: Tx,
  gift: GiftSnapshot | null,
  { kind, role, email, at, fields }: GiftNotification,
) {
  if (!gift?.reservedAt || !gift.reservedById) return;
  const recipientId = role === "owner" ? gift.list.ownerId : gift.reservedById;
  const payload = {
    role,
    titleSnapshot: role === "holder" ? gift.titleSnapshotOnReserve : gift.title,
    ...(kind === "RESERVATION_KEPT_BY_OWNER" && gift.reservationDueAt
      ? { dueAt: gift.reservationDueAt.toISOString(), timeZone: canonicalTimeZone(gift.reservationTimeZone) }
      : {}),
    ...(fields ? { fields: [...fields] } : {}),
  };
  await enqueueNotification(tx, {
    eventKey: giftEventKey(kind, gift.id, at),
    kind,
    giftId: gift.id,
    actorId: role === "owner" ? gift.reservedById : gift.list.ownerId,
    reservationAt: gift.reservedAt,
    phaseAt: gift.reservationPhaseAt,
    recipientId,
    createdAt: at,
    deliverAfter: kind === "GIFT_CLOSED" ? new Date(at.getTime() + UNDO_WINDOW_MS) : at,
    emailRequired: email,
    payload,
  });
}

// Both closure undo and its mail claim take Gift first, then Notification.
export async function lockClosureGift(tx: Tx, giftId: string) {
  const [gift] = await tx.$queryRaw<{ status: string; closedAt: Date | null }[]>`
    SELECT status::text AS status, "closedAt" FROM "Gift" WHERE id = ${giftId} FOR UPDATE
  `;
  // A separate statement reads the clock after LockRows has finished waiting.
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return { gift, now: clock!.now };
}

export async function cancelCloseNotification(tx: Tx, giftId: string, closedAt: Date) {
  await tx.notification.deleteMany({ where: { eventKey: giftEventKey("GIFT_CLOSED", giftId, closedAt) } });
}

function inChannel(kind: NotificationKind, prefs: NotificationPreferences, channel: "inApp" | "email") {
  if (kind === "DATE_FRIEND" || kind === "DATE_OWN") {
    return channel === "inApp" ? prefs.datesInApp : prefs.datesEmail;
  }
  if (kind === "WISH_EXPIRY_SOON" || kind === "WISH_EXPIRY") {
    return channel === "inApp" ? prefs.wishExpiryInApp : prefs.wishExpiryEmail;
  }
  return true;
}

export function notificationIsActionable(row: Notification, gift: GiftSnapshot | null) {
  const phase = row.kind === "RESERVATION_DUE" ? "AWAITING_GIVER" :
    row.kind === "RESERVATION_OWNER_ASK" ? "AWAITING_OWNER" :
      row.kind === "GIFT_GIVEN" ? "GIVEN" : null;
  const ownsAction = row.kind === "RESERVATION_DUE"
    ? gift?.reservedById === row.recipientId
    : gift?.list.ownerId === row.recipientId && gift?.reservedById === row.actorId;
  return Boolean(
    phase && gift?.status === "RESERVED" && !gift.archivedAt && ownsAction &&
    gift.reservationPhase === phase && row.reservationAt && row.phaseAt &&
    row.reservationAt.getTime() === gift.reservedAt?.getTime() &&
    row.phaseAt.getTime() === gift.reservationPhaseAt?.getTime(),
  );
}

/**
 * CLE-124: a wish's reservation is a surprise for its owner. The owner must not
 * learn about a reservation, its release, the owner phase or its automatic
 * release, so rows addressed to them are hidden from every read path.
 *
 * The rule covers rows already written before the change, which is why it lives
 * here and the rows stay in the database: `RESERVATION_CREATED` and
 * `RESERVATION_OWNER_ASK` are owner-only kinds, while the two release kinds also
 * go to the holder and are hidden for the owner by their payload.
 */
export function isHiddenOwnerReservationNotification(
  row: Pick<Notification, "kind" | "payload">,
): boolean {
  if (row.kind === "RESERVATION_CREATED" || row.kind === "RESERVATION_OWNER_ASK") return true;
  if (row.kind !== "RESERVATION_RELEASED" && row.kind !== "RESERVATION_AUTO_RELEASE") return false;
  const payload = row.payload;
  return payload !== null && typeof payload === "object" && !Array.isArray(payload) &&
    (payload as { role?: unknown }).role === "owner";
}

export async function projectNotification(
  row: Notification,
  prefs: NotificationPreferences,
  channel: "inApp" | "email",
  now = new Date(),
): Promise<NotificationItem | null> {
  if (isHiddenOwnerReservationNotification(row)) return null;
  if (row.deliverAfter > now || !inChannel(row.kind, prefs, channel)) return null;
  const raw = row.payload;
  const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  let href: string | null = null;
  let data: object = payload;

  if (row.kind === "FRIEND_INVITE" || row.kind === "FRIEND_ACCEPT" || row.kind === "FRIEND_REJECT") {
    if (!row.actorId || (await relationshipReader.relationsBetween(row.recipientId, row.actorId)).blocked) return null;
    const person = await prisma.user.findUnique({ where: { id: row.actorId }, select: { name: true, nick: true } });
    if (!person?.nick) return null;
    data = { personName: person.name, personNick: person.nick };
    href = `/u/${person.nick}`;
  } else if (row.giftId) {
    const gift = await notificationGiftSnapshot(prisma, row.giftId);
    const holderSnapshot = payload.role === "holder" && row.reservationAt !== null;
    const ownerId = gift?.list.ownerId ?? (holderSnapshot ? row.actorId : null);
    if (!ownerId) return null;
    const relations = await relationshipReader.relationsBetween(row.recipientId, ownerId);
    const visible = gift && VisibilityPolicy.canSee(
      { id: row.recipientId },
      { ...relations, viaListToken: false },
      { ownerId, visibility: gift.visibility, archivedAt: gift.archivedAt },
    );
    if (!visible && !holderSnapshot) return null;

    const sameReservation = Boolean(gift?.reservedAt && row.reservationAt &&
      gift.reservedAt.getTime() === row.reservationAt.getTime());
    const actionable = notificationIsActionable(row, gift);
    // CLE-124/D-49: the holder's name never reaches the owner. A legacy payload
    // may still carry `holderName` from before the change, so it is dropped here
    // for every recipient rather than trusted.
    const { holderName: _legacyHolderName, ...rest } = payload;
    void _legacyHolderName;
    data = {
      ...rest,
      giftId: row.giftId,
      actionable,
      // The payload is historical. The purchase mark is live and holder-only.
      bought: row.kind === "RESERVATION_DUE" && actionable ? gift?.reservationBought : undefined,
    };
    if (visible && gift) {
      href = gift.list.ownerId === row.recipientId ? `/gifts/${row.giftId}` :
        gift.list.owner.nick ? `/u/${gift.list.owner.nick}` : null;
    } else if (gift && sameReservation && gift.status === "RESERVED" && gift.reservedById === row.recipientId) {
      href = "/reservations";
    }
  } else if (row.kind === "DATE_FRIEND") {
    // Date sources must implement their read policy before enqueueing this kind.
    return null;
  }

  const parsed = notificationPayloadSchema.safeParse({ ...data, kind: row.kind });
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    href,
    event: parsed.success ? parsed.data : { kind: "UNKNOWN" },
  };
}

export function notificationPreferences(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: preferenceSelect });
}

export function updateNotificationPreferences(userId: string, data: Partial<NotificationPreferences>) {
  return prisma.user.update({ where: { id: userId }, data, select: preferenceSelect });
}

const PAGE_SIZE = 30;
const PROJECTION_CONCURRENCY = 8;

function notificationWindow(
  userId: string, now: Date, after: Pick<Notification, "createdAt" | "id"> | null, unreadOnly = false,
) {
  return prisma.notification.findMany({
    where: {
      recipientId: userId,
      deliverAfter: { lte: now },
      ...(unreadOnly ? { readAt: null } : {}),
      ...(after ? {
        OR: [
          { createdAt: { lt: after.createdAt } },
          { createdAt: after.createdAt, id: { lt: after.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
  });
}

async function projectWindow(rows: Notification[], prefs: NotificationPreferences, now: Date) {
  const items: NotificationItem[] = [];
  for (let start = 0; start < rows.length; start += PROJECTION_CONCURRENCY) {
    const projected = await Promise.all(rows.slice(start, start + PROJECTION_CONCURRENCY).map(function project(row) {
      return projectNotification(row, prefs, "inApp", now);
    }));
    for (const item of projected) if (item) items.push(item);
  }
  return items;
}

export async function countUnreadNotifications(userId: string) {
  const now = new Date();
  const prefs = await notificationPreferences(userId);
  let after: Notification | null = null;
  let unread = 0;
  for (;;) {
    const rows = await notificationWindow(userId, now, after, true);
    unread += (await projectWindow(rows, prefs, now)).length;
    if (rows.length < PAGE_SIZE) return unread;
    after = rows[rows.length - 1]!;
  }
}

export async function readNotifications(userId: string, cursor?: string): Promise<NotificationFeed> {
  const now = new Date();
  const prefs = await notificationPreferences(userId);
  const items: NotificationItem[] = [];
  let after = cursor
    ? await prisma.notification.findFirst({ where: { id: cursor, recipientId: userId } })
    : null;
  if (cursor && !after) return { items, nextCursor: null };

  for (;;) {
    const rows = await notificationWindow(userId, now, after);
    items.push(...await projectWindow(rows, prefs, now));
    if (items.length > PAGE_SIZE) return { items: items.slice(0, PAGE_SIZE), nextCursor: items[PAGE_SIZE - 1]!.id };
    if (rows.length < PAGE_SIZE) return { items, nextCursor: null };
    after = rows[rows.length - 1]!;
  }
}

export async function readNotification(userId: string, id: string) {
  const row = await prisma.notification.findFirst({ where: { id, recipientId: userId } });
  if (!row) return null;
  const prefs = await notificationPreferences(userId);
  const item = await projectNotification(row, prefs, "inApp");
  // A notification reached from email remains addressable for its recipient
  // when their in-app channel is disabled. It stays out of the feed and count.
  return item ?? (row.emailRequired ? projectNotification(row, prefs, "email") : null);
}

export async function markNotificationRead(userId: string, id: string) {
  if (!await readNotification(userId, id)) return false;
  await prisma.notification.updateMany({ where: { id, recipientId: userId, readAt: null }, data: { readAt: new Date() } });
  return true;
}
