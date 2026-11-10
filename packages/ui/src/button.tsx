import { ButtonFrame as BehaviorFrame, ButtonText as BehaviorText } from "@tamagui/button";
import { styled } from "@tamagui/core";
import { forwardRef, type ComponentRef } from "react";
import { fontFor } from "./font-style";
import { focusRing } from "./pressable";

const Frame = styled(BehaviorFrame, {
  name: "GLButton",
  borderWidth: 1,
  borderColor: "transparent",
  paddingHorizontal: "$card-padding",
  borderRadius: "$md",
  cursor: "pointer",
  ...focusRing,
  variants: {
    variant: {
      primary: {
        minHeight: "$control-height",
        backgroundColor: "$primary hover:$primary-hover",
        opacity: "press:0.9",
      },
      // `button-reserve`: only «Куплю сам» and «Подтвердить» in the reservation confirm.
      reserve: {
        minHeight: "$control-height",
        backgroundColor: "$accent hover:$accent-hover",
        opacity: "press:0.9",
      },
      secondary: {
        minHeight: "$control-height",
        backgroundColor: "$surface",
        borderColor: "$border-strong hover:$foreground",
        opacity: "press:0.9",
      },
      ghost: {
        minHeight: "$touch-target",
        minWidth: "$touch-target",
        backgroundColor: "transparent hover:$muted press:$muted",
      },
      destructive: {
        minHeight: "$control-height",
        backgroundColor: "$destructive hover:$destructive-hover",
        opacity: "press:0.9",
      },
    },
    fullWidth: {
      true: { alignSelf: "stretch" },
    },
    inactive: {
      true: { opacity: 0.4, cursor: "default" },
    },
    busy: {
      true: { opacity: 0.6, cursor: "default" },
    },
  } as const,
  defaultVariants: { variant: "primary" },
});

const Label = styled(BehaviorText, {
  name: "GLButtonLabel",
  ...fontFor("button"),
  fontSize: "$button",
  lineHeight: "$button",
  letterSpacing: "$button",
  textAlign: "center",
  variants: {
    variant: {
      primary: { color: "$primary-foreground" },
      reserve: { color: "$accent-foreground" },
      secondary: { color: "$foreground" },
      ghost: { color: "$primary" },
      destructive: { color: "$destructive-foreground" },
    },
  } as const,
  defaultVariants: { variant: "primary" },
});

export type ButtonVariant = "primary" | "reserve" | "secondary" | "ghost" | "destructive";

export type ButtonProps = {
  /** The visible text and the accessible name. Copy comes from the caller. */
  label: string;
  /**
   * The accessible name when it has to say more than the visible label, e.g. a
   * disabled button's reason. Defaults to `label`.
   */
  ariaLabel?: string;
  /** The id of the visible text that explains a disabled button. */
  ariaDescribedBy?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Does not take a press and is announced as disabled. */
  disabled?: boolean;
  /**
   * Keep the disabled button in the Tab order (`aria-disabled` instead of the
   * `disabled` attribute), so a keyboard user can still find it and read why.
   */
  focusableWhenDisabled?: boolean;
  /** The action is running: dimmed, announced busy, takes no second press. */
  busy?: boolean;
  fullWidth?: boolean;
  testID?: string;
  /** `submit` makes the web button submit its form; the phone ignores it. */
  type?: "button" | "submit";
};

/**
 * The button of the app and of the Next pages (`DESIGN.md` → components
 * `button-primary`, `button-reserve`, `button-secondary`, `button-ghost`).
 * On the web it is a real `<button>` with the label as its name; a disabled one
 * never fires `onPress`.
 */
export const Button = forwardRef<ComponentRef<typeof Frame>, ButtonProps>(function Button(
  {
    label,
    ariaLabel,
    ariaDescribedBy,
    onPress,
    variant = "primary",
    disabled = false,
    focusableWhenDisabled = false,
    busy = false,
    fullWidth,
    testID,
    type = "button",
  },
  ref,
) {
  const blocked = disabled || busy;
  // `busy` keeps the button in the Tab order (focus must not drop to <body> when a
  // form is submitted); only a plain `disabled` is a native disabled button.
  const native = disabled && !focusableWhenDisabled;
  return (
    <Frame
      ref={ref}
      variant={variant}
      fullWidth={fullWidth}
      inactive={disabled}
      busy={busy}
      // A blocked button never submits: it is a plain button for the browser.
      render={native ? <button type="button" disabled /> : <button type={blocked ? "button" : type} />}
      tabIndex={native ? -1 : 0}
      aria-label={ariaLabel ?? label}
      aria-describedby={ariaDescribedBy}
      aria-disabled={blocked}
      aria-busy={busy || undefined}
      data-testid={testID}
      testID={testID}
      onPress={blocked ? undefined : onPress}
    >
      <Label variant={variant}>{label}</Label>
    </Frame>
  );
});

Button.displayName = "Button";
