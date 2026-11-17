-- Story 4.6 / AD-19: a subscription is a directed edge `subscriber → target`
-- created without confirmation. Unlike "Friendship" the pair is not canonical:
-- A→B and B→A are two independent rows, so the unique key is
-- ("subscriberId", "targetId") as stored. A subscription opens only the
-- PUBLIC filter (AD-7) and is not a friendship. Either side may delete the
-- row; Block removes both directions (AD-10 step 4, Story 4.5). Prisma does not
-- model CHECK constraints, so "nobody subscribes to themselves" is written by
-- hand below, like "FriendshipInvite"/"Block".

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_targetId_idx" ON "Subscription"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriberId_targetId_key" ON "Subscription"("subscriberId", "targetId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story 4.6 / AD-19: a subscription is never addressed to its own subscriber.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pair_check" CHECK ("subscriberId" <> "targetId");
