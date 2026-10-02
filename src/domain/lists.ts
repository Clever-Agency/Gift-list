// R1: every user owns exactly two lists (AD-6). No API creates or deletes lists.
export const LIST_TYPES = ["DISCOVERABLE", "FRIENDS_ONLY"] as const;

export type ListType = (typeof LIST_TYPES)[number];

export const LIST_TITLES: Record<ListType, string> = {
  DISCOVERABLE: "Открытый",
  FRIENDS_ONLY: "Для друзей",
};
