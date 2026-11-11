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

/**
 * The same ring in `$ring-inverse` for the dark and red surfaces (`DESIGN.md` →
 * toast → `focus-ring`). Only the colour differs: the surface that takes it
 * (`Pressable` in the toast) already brings style, width and offset from
 * `focusRing` of the same platform half, so the web CSS stays exactly
 * `outline-color` on `:focus-visible` (W12.9-1).
 */
export const focusRingInverse = {
  outlineColor: "focus-visible:$ring-inverse",
} as const;
