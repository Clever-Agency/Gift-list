import { ButtonFrame as BehaviorFrame, ButtonText as BehaviorText } from "@tamagui/button";
import { View, styled } from "@tamagui/core";
import { forwardRef, type ComponentRef } from "react";
import { fontFor } from "./font-style";
import { focusRing } from "./pressable";
import { Spinner } from "./spinner";
import { colors, type ColorToken } from "./tokens";

/**
 * A blocked button (`disabled` or `busy`) keeps its resting look: no hover, no press.
 *
 * Tamagui 3.1.10 compiles `hover:` / `press:` into the atomic class of the *variant*
 * (`._b-…:where(:hover)` inside `@media (hover: hover)`, see
 * `@tamagui/web/dist/cjs/helpers/getSplitStyles.cjs:181-186`), so the class is the same
 * for a live and a blocked button and no rule outside the variant can switch the state
 * off. A blocked button therefore gets its own variant value: the same tokens without
 * the state keys. No colour is added or duplicated.
 */
const BLOCKED_VARIANT = {
  primary: "primaryBlocked",
  reserve: "reserveBlocked",
  secondary: "secondaryBlocked",
  ghost: "ghostBlocked",
  destructive: "destructiveBlocked",
} as const;

export type ButtonVariant = keyof typeof BLOCKED_VARIANT;

/**
 * The label colour of each variant (`DESIGN.md` → components `button-*`), as a
 * theme key. One map for the label and for the busy spinner: `Label` takes the
 * token (`$primary-foreground`), the spinner needs the same colour as a value,
 * because React Native has no `currentColor` inheritance (`spinner.native.tsx`).
 */
const LABEL_COLOR = {
  primary: "primary-foreground",
  reserve: "accent-foreground",
  secondary: "foreground",
  ghost: "primary",
  destructive: "destructive-foreground",
} as const satisfies Record<ButtonVariant, ColorToken>;

const Frame = styled(BehaviorFrame, {
  name: "GLButton",
  borderWidth: 1,
  borderColor: "transparent",
  paddingHorizontal: "$card-padding",
  borderRadius: "$md",
  cursor: "pointer",
  // The busy spinner is positioned against the button (see `SpinnerSlot`).
  position: "relative",
  ...focusRing,
  variants: {
    variant: {
      primary: {
        minHeight: "$control-height",
        backgroundColor: "$primary hover:$primary-hover",
        opacity: "press:0.9",
      },
      primaryBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$primary",
      },
      // `button-reserve`: only «Куплю сам» and «Подтвердить» in the reservation confirm.
      reserve: {
        minHeight: "$control-height",
        backgroundColor: "$accent hover:$accent-hover",
        opacity: "press:0.9",
      },
      reserveBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$accent",
      },
      secondary: {
        minHeight: "$control-height",
        backgroundColor: "$surface",
        borderColor: "$border-strong hover:$foreground",
        opacity: "press:0.9",
      },
      secondaryBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$surface",
        borderColor: "$border-strong",
      },
      ghost: {
        minHeight: "$touch-target",
        minWidth: "$touch-target",
        backgroundColor: "transparent hover:$muted press:$muted",
      },
      ghostBlocked: {
        minHeight: "$touch-target",
        minWidth: "$touch-target",
        backgroundColor: "transparent",
      },
      destructive: {
        minHeight: "$control-height",
        backgroundColor: "$destructive hover:$destructive-hover",
        opacity: "press:0.9",
      },
      destructiveBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$destructive",
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
      primary: { color: `$${LABEL_COLOR.primary}` },
      reserve: { color: `$${LABEL_COLOR.reserve}` },
      secondary: { color: `$${LABEL_COLOR.secondary}` },
      ghost: { color: `$${LABEL_COLOR.ghost}` },
      destructive: { color: `$${LABEL_COLOR.destructive}` },
    },
  } as const,
  defaultVariants: { variant: "primary" },
});

/**
 * The slot of the busy spinner: out of the flex flow at the left padding edge,
 * so the button keeps its width and the label keeps its place when `busy` turns
 * on and off. Nothing else is reserved — a resting button has no invisible gap.
 *
 * The slot lies over the button's own padding only; a label that wide would be
 * one of 37+ characters on a full-width 360 px button (see the W12.8 report).
 * `pointerEvents: "none"` keeps the press on the button.
 */
const SpinnerSlot = styled(View, {
  name: "GLButtonSpinner",
  position: "absolute",
  left: "$card-padding",
  top: 0,
  bottom: 0,
  justifyContent: "center",
  pointerEvents: "none",
});

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
  // A blocked button must not react to hover or press (`DESIGN.md` → Состояния): it
  // takes the variant value without those states. Focus, clicks and the Tab order stay
  // as they are.
  const frameVariant = blocked ? BLOCKED_VARIANT[variant] : variant;
  // `busy` keeps the button in the Tab order (focus must not drop to <body> when a
  // form is submitted); only a plain `disabled` is a native disabled button.
  const native = disabled && !focusableWhenDisabled;
  return (
    <Frame
      ref={ref}
      variant={frameVariant}
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
      {busy ? (
        <SpinnerSlot>
          <Spinner color={colors[LABEL_COLOR[variant]]} />
        </SpinnerSlot>
      ) : null}
      <Label variant={variant}>{label}</Label>
    </Frame>
  );
});

Button.displayName = "Button";
