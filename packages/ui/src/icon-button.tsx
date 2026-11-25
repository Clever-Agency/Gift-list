import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./button";

export type IconButtonVariant = "outline" | "plain" | "primary";

/** `md` — a 44 px control; `sm` — a 32 px control inside the same 44 px target. */
export type IconButtonSize = "sm" | "md";

/** Square controls (toolbars) and round ones (row actions, e.g. accept / decline). */
export type IconButtonShape = "square" | "round";

export type IconButtonProps = {
  /** The accessible name of the icon-only control; the icon itself is decorative. */
  label: string;
  /** The glyph, at `spacing["icon-inline"]` (20) or `icon-nav` (24). */
  icon: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * `outline` (default) keeps the 1 px frame of v8, `plain` drops it for a row of
   * toolbar icons, `primary` is the filled accept action of the friends requests.
   */
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  testID?: string;
};

/**
 * The icon-only control of v8 (`DESIGN.md` → Button → icon button) is the icon-only
 * mode of `Button`: a 44 × 44 target, radius 8 (or a circle with `shape="round"`),
 * 1 px `border` frame with `outline`, none with `plain`, `primary` fill with
 * `primary`. Hover fills `muted`, press dims the target to 90%, focus takes the ring
 * (`$ring`, 2 px, offset 2 px) like every interactive surface. `size="sm"` keeps the
 * 44 px target and draws the 32 px box the request rows use. `label` is the
 * accessible name; the icon is only the picture. A disabled icon button keeps its
 * place in the focus order (`aria-disabled`) and dims to 40%, as before.
 */
export const IconButton = forwardRef<ComponentRef<typeof Button>, IconButtonProps>(
  function IconButton(
    { label, icon, onPress, disabled = false, variant = "outline", size = "md", shape = "square", testID },
    ref,
  ) {
    // `plain` has no frame: in `Button` that is the `ghost` value; the drawn box
    // keeps the same tokens either way (`IconBox` of `button.tsx`).
    const painted: ButtonVariant = variant === "plain" ? "ghost" : variant;
    return (
      <Button
        ref={ref}
        label={label}
        icon={icon}
        iconSize={size}
        shape={shape}
        variant={painted}
        onPress={onPress}
        disabled={disabled}
        // The old `Pressable` kept a disabled control in the focus order: announced
        // with `aria-disabled`, no press. `Button` does the same with this flag.
        focusableWhenDisabled={disabled}
        testID={testID}
      />
    );
  },
);

IconButton.displayName = "IconButton";
