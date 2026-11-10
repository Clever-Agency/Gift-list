/**
 * The focus ring of `DESIGN.md` → «Кольцо фокуса»: `$ring`, 2 px, offset 2 px on
 * every interactive surface. Web half of the platform pair; the phone takes
 * `focus-ring.native.ts`.
 *
 * The ring is a state of the class, not a base style: Tamagui 3.1.10 keeps a
 * `focus-visible:` value in the atomic class of the state
 * (`@tamagui/web/dist/cjs/helpers/getSplitStyles.cjs:181-186`), so the browser
 * paints it on keyboard navigation only and a mouse click leaves no ring.
 */
export const focusRing = {
  outlineColor: "focus-visible:$ring",
  outlineStyle: "focus-visible:solid",
  outlineWidth: "focus-visible:2px",
  outlineOffset: 2,
} as const;
