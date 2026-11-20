import {
  reservationActionBodySchema,
  reservationCardSchema,
  reservationListSchema,
  type ReservationActionBody,
  type ReservationCard,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type ReservationsResult =
  | { ok: true; reservations: ReservationCard[] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type ReservationUpdateResult =
  | { ok: true; reservation: ReservationCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 5.5 (FR-25, A-14, AD-7): the holder's own reservations through
 * `GET /api/v1/me/reservations`. The server reads them by `reservedById`, so the
 * list survives an unfriend or a block and never brings another wish of the
 * owner. The answer is re-checked with the shared contract (AD-12): the card is
 * a closed set, and a body that does not match is `invalid`, not a broken
 * connection, so the screen shows its own retry view without claiming the
 * network is down.
 */
export async function fetchReservations(): Promise<ReservationsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/reservations");
  if (!result.ok) return result;

  const parsed = reservationListSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, reservations: parsed.data.reservations };
}

/**
 * Story 5.5: one action per request on `PATCH /api/v1/me/reservations/:giftId` —
 * `extend`, `bought` or `visibility`. The body is validated with the same closed
 * union the server parses, so two actions in one body or a stray key are
 * `invalid` before anything is sent. The answer is the updated reservation card
 * (not `{ id }`): after an extension the deadline, the phase and its moment change
 * at once, so the screen replaces the card instead of re-reading the list.
 *
 * Removing a reservation stays with `releaseMyReservation`
 * (`DELETE /api/v1/gifts/:id/reserve`, Story 5.2) and is deliberately not here.
 */
export async function updateReservation(
  giftId: string,
  body: ReservationActionBody,
): Promise<ReservationUpdateResult> {
  const payload = reservationActionBodySchema.safeParse(body);
  if (!payload.success) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/me/reservations/${encodeURIComponent(giftId)}`,
    { method: "PATCH", body: payload.data },
  );
  if (!result.ok) return result;

  const parsed = reservationCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, reservation: parsed.data };
}
