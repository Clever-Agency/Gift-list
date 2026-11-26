import { View, styled, type GetProps } from "@tamagui/core";
import { forwardRef, type ComponentRef, type KeyboardEvent } from "react";
import { focusRing } from "./focus-ring";
import { useHoverTransition } from "./hover";
import { pressOnKeyDown } from "./press";
import { pressableRole } from "./pressable-role";

const PressableFrame = styled(View, {
  name: "GLPressable",
  // Web: `role="button"`, phone: `accessibilityRole="button"` and no `role`, so a
  // caller can pass `accessibilityRole="togglebutton"` (W12.10). See the pair.
  ...pressableRole,
  tabIndex: 0,
  cursor: "pointer",
  ...focusRing,
  variants: {
    /**
     * The press feedback lives in a variant value, not in the base style: Tamagui
     * merges a base `opacity` and a state of the same property into one atomic
     * class, so `:where(:active)` won over the 0.4 dim of a blocked surface
     * (`W12.5b-report.md` §2). The blocked value has no `press:` at all.
     */
    inactive: {
      true: { opacity: 0.4, cursor: "default" },
      false: { opacity: "press:0.9" },
    },
    /**
     * The hover fill of a neutral surface: `$muted`, the token every row and chip
     * uses (CLE-129). A surface that paints its own colours — a filled chip, a card
     * — turns the fill off and draws its own hover (`$foreground` frame, a lifted
     * `$shadow-card-hover`).
     */
    hoverFill: {
      true: { backgroundColor: "hover:$muted" },
      false: {},
    },
  } as const,
  defaultVariants: { hoverFill: true },
});

export type PressableProps = Omit<GetProps<typeof PressableFrame>, "disabled" | "inactive"> & {
  /**
   * Announced as disabled (`aria-disabled`) and ignores presses, but keeps its place
   * in the focus order, unlike a native `disabled` button.
   */
  disabled?: boolean;
};

/**
 * A pressable surface for custom controls (cards, chips, radio rows): any `role`,
 * Enter and Space run the press in the browser, and the press feedback is the
 * `opacity: 0.9` the rest of the app gives (`DESIGN.md` → App). A disabled surface
 * keeps its 40% dim and does not react to a press or a hover at all. Use `Button`
 * for a plain button with a label.
 *
 * On the web a live surface fills `$muted` on hover and the fill, the frame and the
 * opacity change with the `quick` preset (160 ms), instant with «уменьшить
 * движение» (`hover.ts`); a phone has no hover and no transition.
 */
export const Pressable = forwardRef<ComponentRef<typeof PressableFrame>, PressableProps>(
  function Pressable({ onPress, disabled, onKeyDown, hoverFill, ...rest }, ref) {
    const blocked = Boolean(disabled);
    const handlePress = blocked ? undefined : (onPress as (() => void) | undefined);
    const press = pressOnKeyDown(handlePress, rest.role as string | undefined);
    // A blocked surface keeps its resting look: no fill and no transition.
    const transition = useHoverTransition();
    function handleKeyDown(event: KeyboardEvent) {
      (onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
      press(event);
    }
    return (
      <PressableFrame
        ref={ref}
        aria-disabled={disabled || undefined}
        {...rest}
        inactive={blocked}
        hoverFill={blocked ? false : (hoverFill ?? true)}
        transition={blocked ? null : transition}
        onPress={handlePress}
        onKeyDown={handleKeyDown}
      />
    );
  },
);

Pressable.displayName = "Pressable";
