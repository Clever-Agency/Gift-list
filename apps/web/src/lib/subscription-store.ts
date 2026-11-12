import "server-only";

import { prisma } from "@/db/client";
import type { SubscriptionStore } from "@/domain/subscription";

/**
 * Prisma adapter for the subscription protocol (AD-19, Story 4.6).
 *
 * No transaction is needed: each protocol step is one statement whose answer
 * is the outcome. `createMany` with `skipDuplicates` leans on the UNIQUE
 * `(subscriberId, targetId)` index, so two simultaneous subscribes leave one
 * row and the loser reports the successful no-op instead of a constraint error.
 * `deleteMany` is the same idempotent shape for removals. The adapter never
 * touches `Friendship`: a subscription is not a friendship (D-31).
 */
export const subscriptionStore: SubscriptionStore = {
  async createSubscription(subscriberId, targetId) {
    const { count } = await prisma.subscription.createMany({
      data: [{ subscriberId, targetId }],
      skipDuplicates: true,
    });
    return count > 0;
  },

  async deleteSubscription(subscriberId, targetId) {
    const { count } = await prisma.subscription.deleteMany({
      where: { subscriberId, targetId },
    });
    return count > 0;
  },

  async hasBlockBetween(firstUserId, secondUserId) {
    const row = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: firstUserId, blockedId: secondUserId },
          { blockerId: secondUserId, blockedId: firstUserId },
        ],
      },
      select: { id: true },
    });
    return row !== null;
  },
};
