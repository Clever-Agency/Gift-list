import { myProfileSchema, type MyProfile } from "@gift-list/contracts";
import { storedTimeZone } from "@/lib/time-zone";

/**
 * CLE-129/T8.1 (D-58, AD-29): every read of the current user's profile fields
 * goes through one select and one mapper, so `GET` and `PATCH`
 * `/api/v1/me/profile` cannot drift. `timeZone` is normalized like `/me` does.
 */
export const myProfileSelect = {
  id: true,
  email: true,
  name: true,
  nick: true,
  timeZone: true,
  hideFromSearch: true,
  birthDay: true,
  birthMonth: true,
  gender: true,
  country: true,
  about: true,
  profileVisibleToFriends: true,
} as const;

export type MyProfileRow = {
  id: string;
  email: string;
  name: string;
  nick: string;
  timeZone: string | null;
  hideFromSearch: boolean;
  birthDay: number | null;
  birthMonth: number | null;
  gender: "MALE" | "FEMALE" | null;
  country: string | null;
  about: string | null;
  profileVisibleToFriends: boolean;
};

export function myProfileFromRow(row: MyProfileRow): MyProfile {
  return myProfileSchema.parse({
    ...row,
    timeZone: storedTimeZone(row.timeZone),
  });
}
