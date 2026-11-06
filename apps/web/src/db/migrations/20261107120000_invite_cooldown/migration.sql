-- Story 4.2.1 / AD-10 step 3 / A-16: a rejected invite starts a 24-hour
-- re-invite cooldown for the canonical pair. The pair is stored in the same
-- ascending order as "Friendship", so a repeat send reads one key. No cron and
-- no status column: a row is live only while "until" > now(), and a successful
-- new send deletes an expired row in its own transaction.
--
-- `rejectedFromUserId` is the sender of the rejected invite (A). Story 4.2.2
-- uses it to show "rejected" only to that side; the recipient sees the hours.
-- Prisma does not model CHECK constraints, so both pair invariants are written
-- by hand below.

-- CreateTable
CREATE TABLE "InviteCooldown" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "rejectedFromUserId" TEXT NOT NULL,
    "until" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InviteCooldown_userHighId_idx" ON "InviteCooldown"("userHighId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCooldown_userLowId_userHighId_key" ON "InviteCooldown"("userLowId", "userHighId");

-- AddForeignKey
ALTER TABLE "InviteCooldown" ADD CONSTRAINT "InviteCooldown_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCooldown" ADD CONSTRAINT "InviteCooldown_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCooldown" ADD CONSTRAINT "InviteCooldown_rejectedFromUserId_fkey" FOREIGN KEY ("rejectedFromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story 4.2.1 / AD-10: one cooldown per undirected pair, in ascending id order,
-- exactly as "Friendship", so the opposite direction cannot store a second row.
ALTER TABLE "InviteCooldown" ADD CONSTRAINT "InviteCooldown_order_check" CHECK ("userLowId" < "userHighId");

-- Story 4.2.1 / AD-10: the rejected sender is one of the two pair members.
ALTER TABLE "InviteCooldown" ADD CONSTRAINT "InviteCooldown_rejected_from_check" CHECK ("rejectedFromUserId" IN ("userLowId", "userHighId"));
