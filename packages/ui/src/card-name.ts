/**
 * The accessible name of a card (`DESIGN.md` → Доступность): title, price, status
 * and tags as one comma-separated phrase. Empty parts are dropped, so a screen
 * reader never hears a double separator; the order and the set of parts stay with
 * the caller, because an owner card and a guest card say the same things but build
 * the parts from their own data.
 *
 * Lives in `packages/ui` so `apps/mobile` (both the owner and the guest card) and
 * the Next pages of `apps/web` name a card the same way (CLE-135, Story 6.4).
 */
export function joinCardName(parts: readonly (string | null)[]): string {
  return parts
    .filter(function hasText(part): part is string {
      return part !== null && part.trim() !== "";
    })
    .join(", ");
}
