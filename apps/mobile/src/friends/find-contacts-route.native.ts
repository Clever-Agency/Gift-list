import type { FindContactsRoute } from "./find-contacts-route";

/**
 * The phone has no contacts sync yet (Story 8.1), so «Найти знакомых» keeps its
 * current behaviour and opens the existing search. The browser twin explains the
 * missing sync first (`find-contacts-route.ts`).
 */
export function findContactsRoute(): FindContactsRoute {
  return "/search";
}
