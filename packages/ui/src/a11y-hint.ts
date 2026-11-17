/**
 * A hint for assistive tech — a field hint, a field error, a group description —
 * web half.
 *
 * `accessibilityHint` is React Native only. On the web React either complains
 * («React does not recognize the `accessibilityHint` prop on a DOM element») or,
 * through a Tamagui view, paints a stray `accessibilityhint` attribute that no
 * browser reads. The web announces the same text with `aria-describedby`, so the
 * caller passes the id of the visible text and the text itself stays unused here
 * — see `a11y-hint.native.ts` for the phone.
 */
export type A11yHintProps = {
  /** The hint text; the phone reads it as `accessibilityHint`. */
  hint?: string;
  /** The id of the visible hint/error text the browser reads through `aria-describedby`. */
  describedBy?: string;
};

export function a11yHintProps({ describedBy }: A11yHintProps) {
  return describedBy ? { "aria-describedby": describedBy } : {};
}
