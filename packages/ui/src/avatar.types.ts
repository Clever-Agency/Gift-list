import { spacing } from "./tokens";

export type AvatarSize = "sm" | "md" | "lg";

/** `online` — в сети, `busy` — занят, `offline` — не в сети (`DESIGN.md` → Avatar). */
export type AvatarStatus = "online" | "busy" | "offline";

/** `DESIGN.md` → spacing `avatar-sm` / `avatar-md` / `avatar-lg`. */
export const AVATAR_EDGES = {
  sm: spacing["avatar-sm"],
  md: spacing["avatar-md"],
  lg: spacing["avatar-lg"],
} as const;

export const AVATAR_DOT_EDGES = { sm: 8, md: 10, lg: 14 } as const;

export const AVATAR_STATUS_COLORS = {
  online: "$status-open",
  busy: "$primary",
  offline: "$muted-foreground",
} as const;

/** The first letters of up to two words of the name: «Анна Ковалёва» → «АК». */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map(function firstLetter(word) {
      return Array.from(word)[0] ?? "";
    })
    .join("")
    .toUpperCase();
}

export type AvatarProps = {
  /** The person's name: the accessible name and the source of the initials. */
  name: string;
  /** The photo; without it (or when it fails to load) the initials fall back in. */
  photoUrl?: string | null;
  size?: AvatarSize;
  /** A dot on the lower edge: «в сети» / «занят» / «не в сети». */
  status?: AvatarStatus;
  /**
   * The translated word for the status, e.g. «в сети». The dot alone is colour, so
   * the meaning goes into the accessible name: «Анна Ковалёва, в сети».
   */
  statusLabel?: string;
  /**
   * The avatar is a picture of the person next to their written name: hide it from
   * screen readers so the name is not read twice.
   */
  decorative?: boolean;
  testID?: string;
};
