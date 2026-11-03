import "server-only";

import type { RelationshipReader, ViewerRelations } from "@/domain/visibility";

/**
 * Relation facts for the pre-Epic-4 schema (Story 3.2). None of the relation
 * tables exist yet, so every answer is "no relation" — the safe, fail-closed
 * default: `FRIENDS` stays shut and `PUBLIC` opens only through the list token
 * the caller adds itself.
 *
 * Epic 4 and Epic 8 replace each field with a real lookup; the port signature
 * already takes the pair those lookups need.
 */
async function relationsBetween(
  viewerId: string | null,
  ownerId: string,
): Promise<Omit<ViewerRelations, "viaListToken">> {
  // Both ids are unused until the tables land; the signature stays honest so
  // callers are written against the final port.
  void viewerId;
  void ownerId;

  return {
    // `Block` in either direction — AD-10, Epic 4.
    blocked: false,
    // Accepted `Friendship` — AD-10, Epic 4.
    friend: false,
    // `Subscription(subscriberId, targetId)` — AD-19, Story 4.x.
    subscriber: false,
    // `ContactMatch(scannerId, foundUserId)` — AD-18, Epic 8.
    contactMatch: false,
  };
}

export const relationshipReader: RelationshipReader = { relationsBetween };
