import { keepReservation } from "@/actions/gift-reservation-keep";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

/**
 * Story 5.6 (FR-25, AD-7, AD-9): the owner answers «Не получал, оставить бронь»
 * on a reservation waiting in `AWAITING_OWNER`. The body is a strict empty
 * object, so `parseJson` rejects a non-JSON content type and the action rejects a
 * smuggled key; 200 carries the owner card in the AD-12 envelope.
 *
 * «Получил» stays with `POST .../close` (Story 5.3) and «Снять бронь» with
 * `DELETE .../reservation` (Story 5.2), so no second route exists.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await keepReservation(request.headers, id, parsed.data));
}

/** Only the owner's keep exists; every other method keeps the AD-12 NOT_FOUND envelope. */
export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
