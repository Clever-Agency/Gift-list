import "server-only";

import {
  type ActionResult,
  type PersonalDate,
  type PersonalDateCreateBody,
  type PersonalDateUpdateBody,
} from "@gift-list/contracts";
import { toPersonalDate } from "@/domain/personal-dates";
import { auth } from "@/lib/auth";
import {
  createPersonalDate,
  deletePersonalDate,
  readPersonalDates,
  updatePersonalDate,
} from "@/lib/personal-dates-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * AD-23 / Story 7.5: a foreign date must look exactly like a missing one, so
 * neither answer confirms that somebody else's row exists.
 */
const dateNotFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Date not found",
};

/**
 * Story 7.5 (AD-23): the eleventh `CUSTOM` date. The text is the approved
 * `errors.reason.DATES_LIMIT` sentence; the limit itself is checked inside the
 * store transaction, never from this count.
 */
const datesLimit = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Invalid input",
  reason: "DATES_LIMIT" as const,
};

/**
 * Story 7.5: the owner's dates of `/profile` — every stored field, including
 * both visibility switches, so the edit form shows the current choices.
 */
export async function listMyDates(headers: Headers): Promise<ActionResult<PersonalDate[]>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const rows = await readPersonalDates(session.user.id);
  return { ok: true, data: rows.map(toPersonalDate) };
}

/** Story 7.5: the owner adds a date; `DATES_LIMIT` is the atomic check of ten. */
export async function createMyDate(
  headers: Headers,
  input: PersonalDateCreateBody,
): Promise<ActionResult<PersonalDate>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const outcome = await createPersonalDate(session.user.id, input);
  if (!outcome.ok) return datesLimit;
  return { ok: true, data: toPersonalDate(outcome.date) };
}

/**
 * Story 7.5: the owner edits one own date. The contract already checked the
 * body; the store re-checks the merged calendar row for a year-only edit and
 * names `day` for the form, like `updateProfile` names its field.
 */
export async function updateMyDate(
  headers: Headers,
  id: string,
  input: PersonalDateUpdateBody,
): Promise<ActionResult<PersonalDate>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const outcome = await updatePersonalDate(session.user.id, id, input);
  if (!outcome.ok) {
    if (outcome.reason === "not-found") return dateNotFound;
    return { ok: false, code: "VALIDATION", message: "Invalid input", field: outcome.field };
  }
  return { ok: true, data: toPersonalDate(outcome.date) };
}

/** Story 7.5: the owner removes one own date; the answer carries its id. */
export async function deleteMyDate(
  headers: Headers,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const deleted = await deletePersonalDate(session.user.id, id);
  if (!deleted) return dateNotFound;
  return { ok: true, data: { id } };
}
