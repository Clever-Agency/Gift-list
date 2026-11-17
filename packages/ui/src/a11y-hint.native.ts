/**
 * A hint for assistive tech — a field hint, a field error, a group description —
 * phone half.
 *
 * React Native announces the text through `accessibilityHint`, which has no DOM
 * equivalent; `aria-describedby` is browser-only. The callers keep exactly the
 * hint they had before the web leak was fixed: the visible hint or the error for
 * a field, the joined hint and group text for a radio row. See `a11y-hint.ts`
 * for the web variant.
 */
export type A11yHintProps = {
  /** The hint text; the phone reads it as `accessibilityHint`. */
  hint?: string;
  /** The id of the visible hint/error text the browser reads through `aria-describedby`. */
  describedBy?: string;
};

export function a11yHintProps({ hint }: A11yHintProps) {
  return hint ? { accessibilityHint: hint } : {};
}
