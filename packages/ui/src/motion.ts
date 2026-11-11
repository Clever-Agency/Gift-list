/**
 * `DESIGN.md` → Движение (DECISION 2026-11-10): a layer moves with the `quick`
 * preset (160 ms) on the web and on a phone; with «уменьшить движение» the shift
 * is off and the layer only fades, for no longer than 100 ms.
 *
 * The durations live next to the Tamagui presets in `animations.ts` and
 * `animations.native.ts`; these names and numbers are the one place the
 * components and their tests read them from.
 */

/** Shift + fade of a layer: 160 ms. */
export const LAYER_QUICK = "quick";
/** Fade only, no shift: 100 ms (the `reduce` path). */
export const LAYER_REDUCE_FADE = "reduceFade";
/** No movement at all: the sheet position jumps. */
export const LAYER_INSTANT = "instant";

/** How long `LAYER_QUICK` takes, in milliseconds. */
export const LAYER_QUICK_MS = 160;
/** How long `LAYER_REDUCE_FADE` takes, in milliseconds. */
export const LAYER_REDUCE_FADE_MS = 100;

/** The transition of a layer that fades: `quick` or, with reduce, a short fade. */
export function layerFade(reduce: boolean): string {
  return reduce ? LAYER_REDUCE_FADE : LAYER_QUICK;
}

/**
 * The sheet's position: `quick` (160 ms) on the web and on a phone. With reduce it
 * jumps (`instant`) — no shift, only the scrim's 100 ms fade is left on screen.
 */
export function sheetMotion(reduce: boolean): string {
  return reduce ? LAYER_INSTANT : LAYER_QUICK;
}

/** How long the layer's exit takes: `onClosed` waits that long on the web. */
export function layerExitMs(reduce: boolean): number {
  return reduce ? LAYER_REDUCE_FADE_MS : LAYER_QUICK_MS;
}
