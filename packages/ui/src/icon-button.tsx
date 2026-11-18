import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Pressable } from "./pressable";

export type IconButtonVariant = "outline" | "plain";

export type IconButtonProps = {
  /** The accessible name of the icon-only control; the icon itself is decorative. */
  label: string;
  /** The glyph, at `spacing["icon-inline"]` (20) or `icon-nav` (24). */
  icon: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * `outline` (default) keeps the 1 px frame of v8; `plain` drops it for a row of
   * toolbar icons. Both keep the same 44 × 44 target and the `muted` hover.
   */
  variant?: IconButtonVariant;
  testID?: string;
};

/**
 * The icon-only button of v8 (`DESIGN.md` → Button → icon button): a 44 × 44 control,
 * radius 8, 1 px `border`, transparent fill. Hover fills `muted`, press dims to 90%,
 * focus takes the ring (`$ring`, 2 px, offset 2 px) like every interactive surface.
 * `label` is the accessible name; the icon is only the picture. Use `Button` when the
 * control has visible text.
 */
export const IconButton = forwardRef<ComponentRef<typeof Pressable>, IconButtonProps>(
  function IconButton({ label, icon, onPress, disabled = false, variant = "outline", testID }, ref) {
    const plain = variant === "plain";
    return (
      <Pressable
        ref={ref}
        role="button"
        aria-label={label}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        width="$touch-target"
        height="$touch-target"
        alignItems="center"
        justifyContent="center"
        borderRadius="$md"
        borderWidth={1}
        borderColor={plain ? "transparent" : "$border hover:$foreground"}
        backgroundColor="transparent hover:$muted press:$muted"
        // The icon draws with `currentColor`, so the colour of the control is its ink.
        color="$foreground"
      >
        {icon}
      </Pressable>
    );
  },
);

IconButton.displayName = "IconButton";
