-- Story 4.1.1 / AD-10: friendship protocol storage. Pending is a directed row in
-- "FriendshipInvite"; an accepted friendship is one canonical edge in
-- "Friendship"; "Block" is read by the invite protocol and by the relation
-- reader. Prisma does not model CHECK constraints, so the pair invariants are
-- written by hand below.

-- CreateTable
CREATE TABLE "FriendshipInvite" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendshipInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendshipInvite_toUserId_idx" ON "FriendshipInvite"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FriendshipInvite_fromUserId_toUserId_key" ON "FriendshipInvite"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "Friendship_userHighId_idx" ON "Friendship"("userHighId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userLowId_userHighId_key" ON "Friendship"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "FriendshipInvite" ADD CONSTRAINT "FriendshipInvite_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendshipInvite" ADD CONSTRAINT "FriendshipInvite_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story 4.1.1 / AD-10: an invite is never addressed to its sender.
ALTER TABLE "FriendshipInvite" ADD CONSTRAINT "FriendshipInvite_pair_check" CHECK ("fromUserId" <> "toUserId");

-- Story 4.1.1 / AD-10: one undirected edge, stored in ascending id order, so the
-- opposite direction can never be inserted as a second row.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_order_check" CHECK ("userLowId" < "userHighId");

-- Story 4.1.1 / AD-10: nobody blocks themselves.
ALTER TABLE "Block" ADD CONSTRAINT "Block_pair_check" CHECK ("blockerId" <> "blockedId");
