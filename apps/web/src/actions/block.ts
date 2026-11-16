import "server-only";

import {
  blockedPageSchema,
  type ActionResult,
  type BlockData,
  type BlockedListQuery,
  type BlockedPage,
  type UnblockData,
} from "@gift-list/contracts";
import {
  blockUser,
  readBlockedPage,
  unblockUser,
  type BlockedPerson,
} from "@/domain/block";
import { auth } from "@/lib/auth";
import { findUserIdByNick } from "@/lib/find-user-by-nick";
import { blockedPeopleReader, friendshipStore } from "@/lib/friendship-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** Unknown, old or malformed nick: the same closed answer, without a name. */
const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Not found",
};

/**
 * A self pair is the closed `FORBIDDEN` refusal, exactly like the neighbouring
 * self unfriend and self subscription. No `ERROR_REASONS` value is invented: the
 * client shows the generic `FORBIDDEN` text, and both successful outcomes are
 * not errors at all. A Block in either direction never turns into a refusal
 * here, because blocking is idempotent and a mutual block must stay invisible.
 */
const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Forbidden",
};

/**
 * The domain refuses a cursor it did not issue with `VALIDATION` /
 * `INVALID_CURSOR`. The wire keeps the established `VALIDATION` shape of the
 * list endpoints — `field` names the parameter, no new `ERROR_REASONS` entry.
 */
const invalidCursor = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Invalid cursor",
  field: "cursor",
};

/**
 * Story 4.5 (FR-24, AD-10 step 4): the session user blocks the owner of the
 * nick's profile. The target is exactly one nick path segment and the body is
 * not read, so an arbitrary user id can never select another person.
 *
 * The nick is resolved directly by `findUserIdByNick`, not through the profile
 * gate: after a block the profile answers `not_found` in both directions, and
 * the blocked side still has to reach the unblock. An unknown, renamed or
 * malformed nick is one closed `NOT_FOUND`; a self pair is `FORBIDDEN` without
 * a reason. Both success outcomes (`BLOCKED`, `ALREADY_BLOCKED`) are 200, and a
 * reverse block is neither refused nor revealed: the answer describes only the
 * viewer's own row.
 */
export async function blockUserByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<BlockData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const otherUserId = await findUserIdByNick(nick);
  if (otherUserId === null) return notFound;

  const result = await blockUser(
    { viewerId: session.user.id, otherUserId },
    friendshipStore,
  );
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * Story 4.5 (AD-10 step 4): the session user removes their own block of the
 * nick's owner. Only the viewer's directed row goes away; the other side's block
 * stays and nothing is restored — no friendship, invite or subscription.
 *
 * The nick is resolved the same direct way as in {@link blockUserByNick}: the
 * profile of a blocked person is `not_found`, so the unblock cannot depend on
 * that gate. A row that is already gone is the successful no-op `NOT_BLOCKED`,
 * never an error; a self pair is `FORBIDDEN` without a reason.
 */
export async function unblockUserByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<UnblockData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const otherUserId = await findUserIdByNick(nick);
  if (otherUserId === null) return notFound;

  const result = await unblockUser(
    { viewerId: session.user.id, otherUserId },
    friendshipStore,
  );
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * One row of «Заблокированные» on the wire (Story 4.5.2). The domain person
 * carries `id` and `blockedAt` for the cursor and the order only, so they are
 * dropped here; no email, avatar, relation or wish field is added.
 */
function toBlockedCard(person: BlockedPerson) {
  return { displayName: person.displayName, nick: person.nick };
}

/**
 * Story 4.5.2 (AD-10 step 4): `GET /api/v1/me/blocks` — the people the session
 * user blocked, newest first, one cursor page. Only the viewer's own rows are
 * read (`blockerId = viewerId`), so someone who blocked the viewer is never
 * listed here. The block time and the internal id stay in the cursor.
 */
export async function listBlocked(
  input: BlockedListQuery,
  headers: Headers,
): Promise<ActionResult<BlockedPage>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const result = await readBlockedPage(blockedPeopleReader, {
    viewerId: session.user.id,
    cursor: input.cursor,
  });
  if (!result.ok) return invalidCursor;

  return {
    ok: true,
    data: blockedPageSchema.parse({
      items: result.items.map(toBlockedCard),
      nextCursor: result.nextCursor,
      total: result.total,
    }),
  };
}
