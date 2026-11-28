/**
 * State of the `Switch` for assistive tech, phone half.
 *
 * React Native paints the checkable state from `accessibilityState`: Android
 * marks the node checkable and checked (`ReactAccessibilityDelegate.kt`), iOS
 * appends "checked"/"unchecked" to the value. The state is passed explicitly,
 * because the switch should never rely on a library mapping `aria-checked` for
 * TalkBack/VoiceOver. `disabled` rides in the same object, so the switch is
 * announced unavailable even where the press is already blocked.
 *
 * `aria-checked` is not returned here: `aria-*` are DOM attributes, and the web
 * half `switch-a11y.ts` carries them.
 */
export type SwitchA11yProps = {
  checked: boolean;
  disabled?: boolean;
};

export function switchA11yProps({ checked, disabled }: SwitchA11yProps) {
  return {
    accessibilityState: { checked, disabled: Boolean(disabled) },
  } as const;
}
