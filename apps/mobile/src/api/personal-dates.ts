import {
  personalDateSchema,
  type PersonalDate,
  type PersonalDateCreateBody,
  type PersonalDateUpdateBody,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

/**
 * Story 7.5 (AD-23): the owner's own dates of `/profile`. Every answer is
 * re-checked with the shared contract (AD-12), so a body outside it is `invalid`,
 * not a broken connection. The edit form reads the row from the list answer: the
 * single-date route has no `GET`.
 */
export type PersonalDatesResult =
  | { ok: true; data: PersonalDate[] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type PersonalDateResult =
  | { ok: true; data: PersonalDate }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type PersonalDateDeleteResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

function parseDates(value: unknown): PersonalDate[] | null {
  if (!Array.isArray(value)) return null;
  const dates: PersonalDate[] = [];
  for (const item of value) {
    const parsed = personalDateSchema.safeParse(item);
    if (!parsed.success) return null;
    dates.push(parsed.data);
  }
  return dates;
}

function parseDate(value: unknown): PersonalDate | null {
  const parsed = personalDateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** `GET /api/v1/me/dates`: every stored field, switches included. */
export async function listMyDates(): Promise<PersonalDatesResult> {
  const result = await apiRequest<unknown>("/api/v1/me/dates");
  if (!result.ok) return result;

  const dates = parseDates(result.data);
  if (dates === null) return { ok: false, invalid: true };

  return { ok: true, data: dates };
}

/** `POST /api/v1/me/dates`: the eleventh date is `VALIDATION` + `DATES_LIMIT`. */
export async function createMyDate(
  body: PersonalDateCreateBody,
): Promise<PersonalDateResult> {
  const result = await apiRequest<unknown>("/api/v1/me/dates", {
    method: "POST",
    body,
  });
  if (!result.ok) return result;

  const date = parseDate(result.data);
  if (date === null) return { ok: false, invalid: true };

  return { ok: true, data: date };
}

/** `PATCH /api/v1/me/dates/:id`: the answer is the updated row. */
export async function updateMyDate(
  id: string,
  body: PersonalDateUpdateBody,
): Promise<PersonalDateResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/dates/${encodeURIComponent(id)}`,
    { method: "PATCH", body },
  );
  if (!result.ok) return result;

  const date = parseDate(result.data);
  if (date === null) return { ok: false, invalid: true };

  return { ok: true, data: date };
}

/** `DELETE /api/v1/me/dates/:id`: the answer carries the removed id. */
export async function deleteMyDate(id: string): Promise<PersonalDateDeleteResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/dates/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const data = result.data as { id?: unknown } | null;
  if (data == null || data.id !== id) return { ok: false, invalid: true };

  return { ok: true };
}
