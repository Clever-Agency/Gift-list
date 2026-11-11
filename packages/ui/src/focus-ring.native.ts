/**
 * The focus ring of `DESIGN.md` → «Кольцо фокуса», phone half of the platform
 * pair. React Native never sets `:focus-visible`, so on Android and iOS the same
 * ring follows `focus` — the state of an external keyboard, and the closest a
 * phone has to a keyboard ring.
 *
 * The mechanism is the same `outline*` the web uses, not a border: React Native
 * 0.88 draws `outlineColor` / `outlineStyle` / `outlineWidth` / `outlineOffset`
 * outside the border box (`react-native/Libraries/Components/View/
 * ReactNativeStyleAttributes.js:258-261`), so the ring takes no room and does not
 * move the layout. Tamagui keeps `focus:` as a state of the surface
 * (`@tamagui/web/dist/cjs/helpers/getSplitStyles.native.cjs:197`), attaches the
 * focus handler for it (`@tamagui/web/dist/cjs/createComponent.native.cjs:
 * 846-848`) and turns it on in `onFocus` (`:914-925`); `2px` resolves to the
 * number 2 a phone expects (`getSplitStyles.native.cjs:1695-1701`).
 */
export const focusRing = {
  outlineColor: "focus:$ring",
  outlineStyle: "focus:solid",
  outlineWidth: "focus:2px",
  outlineOffset: 2,
} as const;

/**
 * The inverse colour of the ring for the dark and red surfaces (`toast`),
 * phone half of the platform pair: the same `focus` state as `focusRing`, with
 * `$ring-inverse` instead of `$ring`. Style, width and offset come from
 * `focusRing` on the surface itself (W12.9-1).
 */
export const focusRingInverse = {
  outlineColor: "focus:$ring-inverse",
} as const;
