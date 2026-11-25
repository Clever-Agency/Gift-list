ALTER TABLE "User" ADD COLUMN "datesInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "datesEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "wishExpiryInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "wishExpiryEmail" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "NotificationKind" AS ENUM (
  'FRIEND_INVITE', 'FRIEND_ACCEPT', 'FRIEND_REJECT', 'RESERVATION_CREATED',
  'RESERVATION_RELEASED', 'RESERVATION_DUE', 'RESERVATION_OWNER_ASK',
  'RESERVATION_KEPT_BY_OWNER', 'RESERVATION_AUTO_RELEASE', 'GIFT_EDITED',
  'GIFT_DELETED', 'GIFT_CLOSED', 'GIFT_GIVEN', 'DATE_FRIEND', 'DATE_OWN',
  'SUGGESTION', 'WISH_EXPIRY_SOON', 'WISH_EXPIRY'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "giftId" TEXT,
  "actorId" TEXT,
  "reservationAt" TIMESTAMPTZ(3),
  "phaseAt" TIMESTAMPTZ(3),
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "deliverAfter" TIMESTAMPTZ(3) NOT NULL,
  "readAt" TIMESTAMPTZ(3),
  "emailRequired" BOOLEAN NOT NULL DEFAULT false,
  "emailFirstAttemptAt" TIMESTAMPTZ(3),
  "emailLeaseUntil" TIMESTAMPTZ(3),
  "emailDoneAt" TIMESTAMPTZ(3),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Notification_recipientId_eventKey_key" ON "Notification"("recipientId", "eventKey");
CREATE INDEX "Notification_recipientId_createdAt_id_idx" ON "Notification"("recipientId", "createdAt", "id");
CREATE INDEX "Notification_recipientId_readAt_deliverAfter_idx" ON "Notification"("recipientId", "readAt", "deliverAfter");
CREATE INDEX "Notification_emailRequired_emailDoneAt_deliverAfter_idx" ON "Notification"("emailRequired", "emailDoneAt", "deliverAfter");
