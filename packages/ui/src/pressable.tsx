import { View, styled, type GetProps } from "@tamagui/core";
import { forwardRef, type ComponentRef, type KeyboardEvent } from "react";
import { pressOnKeyDown } from "./press";

/** The focus ring (`DESIGN.md` → `ring`), drawn on keyboard focus only. */
export const focusRing = {
  outlineColor: "focus-visible:$ring",
  outlineStyle: "focus-visible:solid",
  outlineWidth: "focus-visible:2px",
  outlineOffset: 2,
} as const;

const PressableFrame = styled(View, {
  name: "GLPressable",
  role: "button",
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
  } as const,
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
 * keeps its 40% dim and does not react to a press at all. Use `Button` for a plain
 * button with a label.
 */
export const Pressable = forwardRef<ComponentRef<typeof PressableFrame>, PressableProps>(
  function Pressable({ onPress, disabled, onKeyDown, ...rest }, ref) {
    const blocked = Boolean(disabled);
    const handlePress = blocked ? undefined : (onPress as (() => void) | undefined);
    const press = pressOnKeyDown(handlePress, rest.role as string | undefined);
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
        onPress={handlePress}
        onKeyDown={handleKeyDown}
      />
    );
  },
);

Pressable.displayName = "Pressable";
