// CLE-129/T8.1 (D-58, AD-29) — the profile fields of `User`. Rules only: no
// Prisma, no React/Next.js (AD-1). The contract validates the wire shape;
// this module re-checks the same invariants for direct callers of the use-case
// and normalizes the values into the shape the row writer needs.
import {
  ABOUT_MAX,
  isCountryCode,
  isValidBirthDate,
  type ProfileUpdateBody,
} from "@gift-list/contracts";

/** The columns `PATCH /api/v1/me/profile` may write; absent key = no change. */
export type ProfileWrite = {
  birthDay?: number | null;
  birthMonth?: number | null;
  gender?: "MALE" | "FEMALE" | null;
  country?: string | null;
  about?: string | null;
  profileVisibleToFriends?: boolean;
};

export type ProfileWriteResult =
  | { readonly ok: true; readonly data: ProfileWrite }
  | { readonly ok: false; readonly field: "birthDay" | "country" | "about" };

/**
 * Turns a contract-valid body into the update payload.
 *
 * The birthday is a pair and is validated again here: half a pair and a day
 * that does not exist in that month (30 February) are refused on `birthDay`;
 * 29 February is valid because no year is stored (AD-23). The country is
 * trimmed and upper-cased (`"by"` → `"BY"`) before the ISO list is checked.
 * An empty or blank «Обо мне» becomes `null`, and the 500-character cap is
 * measured after trimming.
 */
export function profileFieldsForWrite(input: ProfileUpdateBody): ProfileWriteResult {
  const dayGiven = input.birthDay !== undefined;
  const monthGiven = input.birthMonth !== undefined;
  if (dayGiven || monthGiven) {
    const day = input.birthDay ?? null;
    const month = input.birthMonth ?? null;
    if ((day === null) !== (month === null)) return { ok: false, field: "birthDay" };
    if (day !== null && month !== null && !isValidBirthDate(day, month)) {
      return { ok: false, field: "birthDay" };
    }
  }

  const data: ProfileWrite = {};
  if (dayGiven) data.birthDay = input.birthDay ?? null;
  if (monthGiven) data.birthMonth = input.birthMonth ?? null;
  if (input.gender !== undefined) data.gender = input.gender;

  if (input.country !== undefined) {
    if (input.country === null) {
      data.country = null;
    } else {
      const country = input.country.trim().toUpperCase();
      if (!isCountryCode(country)) return { ok: false, field: "country" };
      data.country = country;
    }
  }

  if (input.about !== undefined) {
    if (input.about === null) {
      data.about = null;
    } else {
      const about = input.about.trim();
      if (about.length > ABOUT_MAX) return { ok: false, field: "about" };
      data.about = about === "" ? null : about;
    }
  }

  if (input.profileVisibleToFriends !== undefined) {
    data.profileVisibleToFriends = input.profileVisibleToFriends;
  }
  return { ok: true, data };
}
