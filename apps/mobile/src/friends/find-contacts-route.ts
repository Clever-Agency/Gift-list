/**
 * Story 6.5: in a browser «Найти знакомых» opens its own screen, which explains
 * that the contacts sync lives in the phone app and offers the existing search by
 * nick. Story 8.1 (the contacts sync itself) is not here yet, so the phone keeps
 * the current shortcut to `/search` — `find-contacts-route.native.ts` is that twin.
 */
export type FindContactsRoute = "/friends/contacts" | "/search";

export function findContactsRoute(): FindContactsRoute {
  return "/friends/contacts";
}
