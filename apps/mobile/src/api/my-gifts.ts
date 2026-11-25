import {
  giftCardSchema,
  giftReservationWarningSchema,
  giftVisibilityPreviewSchema,
  isNotFound,
  listDataSchema,
  type GiftCard,
  type GiftInputDraft,
  type GiftReservationWarning,
  type GiftUpdate,
  type GiftVisibilityPreview,
  type GiftVisibilityPreviewQuery,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type MyGiftsResult =
  | {
      ok: true;
      access: "gifts";
      gifts: GiftCard[];
      /** Owner archive. Empty when the server omits the key (Story 2.6). */
      archived: GiftCard[];
      /** Full archive size; `archived` holds at most the newest 100. */
      archivedTotal: number | null;
      publicToken: string | null;
    }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The create, the single read and the edit all answer with the same AD-12 card,
 * so they share one outcome type instead of three identical ones.
 */
export type GiftResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type CreateGiftResult = GiftResult;

export type DeleteGiftResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The preflight of a visibility change (CLE-82/S23.2) answers `{ wouldCancelReservation }`
 * in the AD-12 envelope, so a body that does not match is its own outcome.
 */
export type GiftVisibilityPreviewResult =
  | { ok: true; preview: GiftVisibilityPreview }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 5.2: the owner's preflight before releasing someone else's reservation
 * answers only the warning (`BOUGHT` | `GIVEN` | `null`), no holder, due date or
 * `bought` (AD-12, FR-31). A body that does not match the closed contract is
 * `invalid`, not a broken connection.
 */
export type ReservationWarningResult =
  | { ok: true; warning: GiftReservationWarning["warning"] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** Story 5.2: the owner's release also answers `{ id }`; the screen rereads the list. */
export type ReleaseReservationResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * AD-7 owner branch behind `/api/v1/me/gifts` (AD-17: the app talks only to `api/v1`).
 * The payload is re-checked with the shared contract (AD-12): `listDataSchema` is
 * `{ access, gifts: giftCardSchema[], publicToken? }`, a closed set on every card.
 * A body that does not match is its own outcome (`invalid`): the screen still
 * recovers with the retry view, but it does not claim a broken connection. The
 * anomaly `NOT_FOUND` of the owner read stays the closed `access: "not_found"`
 * state: it is not an empty list (EXPERIENCE → State Patterns → «Список не
 * найден»).
 *
 * Story 2.4: the owner answer carries the immutable `publicToken` (AD-6), from
 * which the screen builds `https://{домен}/l/{publicToken}`. The server repairs
 * a missing `List` row and repeats the owner read, so the token is present for a
 * zero-gift wishlist too. `null` is only a defensive fallback for an unexpected
 * older/inconsistent server payload; the token does not depend on the nick (A-26).
 */
export async function fetchMyGifts(): Promise<MyGiftsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts");
  if (isNotFound(result)) return { ok: true, access: "not_found" };
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return {
    ok: true,
    access: "gifts",
    gifts: parsed.data.gifts,
    archived: parsed.data.archived ?? [],
    archivedTotal: parsed.data.archivedTotal ?? null,
    publicToken: parsed.data.publicToken ?? null,
  };
}

/**
 * Story 2.6: `POST /api/v1/me/gifts/{id}/restore` puts an archived wish back.
 * `expiresOn` is the new day, or `null` to leave the wish without a date.
 */
export async function restoreGift(
  id: string,
  expiresOn: string | null,
): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/restore`,
    { method: "POST", body: { expiresOn } },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 2.2 (FR-10): `POST /api/v1/me/gifts` creates the owner's wish and answers
 * with the AD-12 card. The transport, timeout and envelope live in `apiRequest`;
 * the card is re-checked with the shared contract (AD-12) like the list read, so
 * an unexpected payload is `invalid`, not a broken connection.
 *
 * The body is the schema's input side (`GiftInputDraft`): `visibility` and
 * `quantity` are optional there, so a caller may rely on the contract's
 * `PUBLIC`/`SINGLE` defaults instead of hard-coding them.
 */
export async function createGift(input: GiftInputDraft): Promise<CreateGiftResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts", {
    method: "POST",
    body: input,
  });
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 2.2 (FR-10): `GET /api/v1/me/gifts/{id}` reads one own wish, so the edit
 * screen loads a single card instead of picking it out of the list. The id is a
 * path segment, hence encoded; the card is re-checked with the shared contract
 * (AD-12) like the list read, so an unexpected payload is `invalid` rather than
 * a broken connection.
 */
export async function fetchGift(id: string): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 2.3 (FR-10): `DELETE /api/v1/me/gifts/{id}` removes a wish of the owner's
 * list and answers with the deleted id. The id is a path segment, hence encoded; a
 * body that does not echo the same id is `invalid` rather than a broken connection.
 * The server answers NOT_FOUND for a foreign, archived or missing wish (AD-7). Story
 * 5.4: a reserved wish is deleted too — the server releases the reservation through
 * `GiftStatusService` and deletes the row in one transaction — so CONFLICT now means
 * only that the row changed under the request, and the screen re-reads the wish.
 */
export async function deleteGift(id: string): Promise<DeleteGiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const data = result.data;
  if (typeof data !== "object" || data === null) {
    return { ok: false, invalid: true };
  }
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id !== id) {
    return { ok: false, invalid: true };
  }

  return { ok: true };
}

/**
 * Story 2.2 (FR-10, AD-1): `PATCH /api/v1/me/gifts/{id}` edits an own wish. The
 * body is a partial — an absent field keeps its stored value — and the answer is
 * the AD-12 card, re-checked here like the create.
 */
export async function updateGift(
  id: string,
  input: GiftUpdate,
): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * CLE-82 (FR-10 ред. 2026-11-11, AD-7): preflight of a visibility change on the
 * owner's wish — `GET /api/v1/me/gifts/{id}/visibility?visibility=FRIENDS`.
 * It writes nothing and answers whether the new value would take the holder's
 * access away, so the screens show the confirm «Бронирующий потеряет доступ,
 * бронь снимется» only on `true`. The write repeats the same rule inside its own
 * transaction, so this answer may be stale without becoming unsafe. The id is a
 * path segment (encoded); the value is one enum word, so it needs no list query.
 * The answer is re-checked with the shared contract: another body is `invalid`.
 */
export async function previewGiftVisibility(
  id: string,
  visibility: GiftVisibilityPreviewQuery["visibility"],
): Promise<GiftVisibilityPreviewResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/visibility?visibility=${encodeURIComponent(visibility)}`,
  );
  if (!result.ok) return result;

  const parsed = giftVisibilityPreviewSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, preview: parsed.data };
}

/**
 * Story 5.2 (FR-31, AD-12): the owner's preflight of a reservation release —
 * `GET /api/v1/me/gifts/{id}/reservation`. It only reads and answers
 * `{ warning }`: `BOUGHT` when the holder marked the gift as bought, `null`
 * otherwise. The body carries no holder, due date, phase or `bought`, and the
 * schema is strict, so anything extra is `invalid`.
 *
 * Story 5.4: deletion asks the same question (AD-7 gives one `warning` to both a
 * release and a delete), so the body of the delete confirm comes from here instead
 * of a second route; the request and its answer are unchanged.
 */
export async function fetchReservationWarning(id: string): Promise<ReservationWarningResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/reservation`,
  );
  if (!result.ok) return result;

  const parsed = giftReservationWarningSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, warning: parsed.data.warning };
}

/**
 * Story 5.2: `DELETE /api/v1/me/gifts/{id}/reservation` frees the holder's
 * reservation of an own wish in any phase. The answer is `{ id }`, not a card:
 * the owner rereads the list, so nothing else is needed. A body that does not
 * echo the same id is `invalid`, as the owner's delete.
 */
export async function releaseReservation(id: string): Promise<ReleaseReservationResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/reservation`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const data = result.data;
  if (typeof data !== "object" || data === null) return { ok: false, invalid: true };
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id !== id) return { ok: false, invalid: true };

  return { ok: true };
}

/**
 * Story 5.6 (FR-29, AD-9): `POST /api/v1/me/gifts/{id}/reservation/keep` — the
 * owner answers «Не получал, оставить бронь» on an expired reservation. The body
 * is the contract's strict empty object (`{}`), so the transport sends
 * `content-type: application/json`; a key nobody understands would be `VALIDATION`
 * on the server, never a silent write. The answer is the owner's AD-12 card with
 * the reservation back in `ACTIVE`, re-checked here like the close and the undo
 * close. `CONFLICT` means cron or another request moved the row first: the screen
 * rereads the list instead of retrying blindly.
 */
export async function keepReservation(id: string): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/reservation/keep`,
    { method: "POST", body: {} },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 5.3 (FR-32, ARCH-A5): `POST /api/v1/me/gifts/{id}/close` marks an own
 * `OPEN` or `RESERVED` wish as received. The answer is the owner's AD-12 card,
 * re-checked with the shared contract; a closed card carries `undoUntil`, the
 * moment the server's undo window ends. The screen counts down from that moment
 * and never keeps the ten minutes itself: the server refuses a late undo anyway.
 *
 * A late undo of an already closed wish answers `CONFLICT` with
 * `reason: "UNDO_WINDOW_EXPIRED"`. The envelope keeps the reason, so the caller
 * tells it apart from a plain `CONFLICT` and shows «Время на отмену вышло».
 */
export async function closeGift(id: string): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/close`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 5.3 (D-43, ARCH-A5): `POST /api/v1/me/gifts/{id}/undo-close` returns a
 * closed wish to the status it was closed from. The answer is the owner's card
 * (`undoUntil: null`), so the screen replaces the card instead of rereading the
 * list. Outside the window the same request is `CONFLICT` with the reason above.
 * The body is empty, hence no `content-type`, as the close.
 */
export async function undoGiftClose(id: string): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/undo-close`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}
