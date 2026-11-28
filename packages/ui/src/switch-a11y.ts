/**
 * State of the `Switch` for assistive tech, web half.
 *
 * The browser reads the state from `aria-checked`; `aria-disabled` comes from
 * `Pressable` itself. The phone has no `aria-checked` in the accessibility tree —
 * it reads `accessibilityState` instead (`switch-a11y.native.ts`).
 */
export type SwitchA11yProps = {
  checked: boolean;
  disabled?: boolean;
};

export function switchA11yProps({ checked }: SwitchA11yProps) {
  return { "aria-checked": checked } as const;
}
