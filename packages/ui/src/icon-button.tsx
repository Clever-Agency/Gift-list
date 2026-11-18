import { XStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Pressable } from "./pressable";

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

const VISUAL_SIZE = { sm: 32, md: 44 } as const;

/**
 * The icon-only button of v8 (`DESIGN.md` → Button → icon button): a 44 × 44 target,
 * radius 8 (or a circle with `shape="round"`), 1 px `border`, transparent fill. Hover
 * fills `muted`, press dims to 90%, focus takes the ring (`$ring`, 2 px, offset 2 px)
 * like every interactive surface. `size="sm"` keeps the 44 px target and draws the
 * 32 px circle the request rows use. `label` is the accessible name; the icon is only
 * the picture. Use `Button` when the control has visible text.
 */
export const IconButton = forwardRef<ComponentRef<typeof Pressable>, IconButtonProps>(
  function IconButton(
    { label, icon, onPress, disabled = false, variant = "outline", size = "md", shape = "square", testID },
    ref,
  ) {
    const visual = VISUAL_SIZE[size];
    const primary = variant === "primary";
    return (
      <Pressable
        ref={ref}
        role="button"
        aria-label={label}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        minWidth="$touch-target"
        minHeight="$touch-target"
        alignItems="center"
        justifyContent="center"
      >
        <XStack
          testID="icon-button-visual"
          width={visual}
          height={visual}
          alignItems="center"
          justifyContent="center"
          borderRadius={shape === "round" ? "$full" : "$md"}
          borderWidth={variant === "plain" ? 0 : 1}
          borderColor={variant === "outline" ? "$border hover:$foreground" : "transparent"}
          backgroundColor={primary ? "$primary hover:$primary-hover press:$primary-hover" : "transparent hover:$muted press:$muted"}
          // The icon draws with `currentColor`, so the colour of the control is its ink.
          color={primary ? "$primary-foreground" : "$foreground"}
        >
          {icon}
        </XStack>
      </Pressable>
    );
  },
);

IconButton.displayName = "IconButton";
