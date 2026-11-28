import { ButtonFrame as BehaviorFrame, ButtonText as BehaviorText } from "@tamagui/button";
import { View, styled } from "@tamagui/core";
import { XStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { a11yHintProps } from "./a11y-hint";
import { fontFor } from "./font-style";
import { focusRing } from "./focus-ring";
import { hoverTransition } from "./hover";
import { layerFade } from "./motion";
import { Spinner } from "./spinner";
import { useThemeColor } from "./theme-color";
import type { ColorToken } from "./tokens";
import { useReduceMotion } from "./use-reduce";

/** The public variants, in the order the catalog shows them. */
export const BUTTON_VARIANTS = [
  "primary",
  "reserve",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/**
 * A blocked button (`disabled` or `busy`) keeps its resting look: no hover, no press.
 *
 * Tamagui 3.1.10 compiles `hover:` / `press:` into the atomic class of the *variant*
 * (`._b-…:where(:hover)` inside `@media (hover: hover)`, see
 * `@tamagui/web/dist/cjs/helpers/getSplitStyles.cjs:181-186`), so the class is the same
 * for a live and a blocked button and no rule outside the variant can switch the state
 * off. A blocked button therefore gets its own variant value: the same tokens without
 * the state keys. No colour is added or duplicated.
 *
 * These `*Blocked` values are internal: callers pick a public variant and `Button`
 * swaps it while the button is blocked.
 */
const BLOCKED_VARIANT = {
  primary: "primaryBlocked",
  reserve: "reserveBlocked",
  secondary: "secondaryBlocked",
  outline: "outlineBlocked",
  ghost: "ghostBlocked",
  destructive: "destructiveBlocked",
} as const satisfies Record<ButtonVariant, string>;

/**
 * The label colour of each variant (`DESIGN.md` → components `button-*`), as a
 * theme key. One map for the label and for the busy spinner: `Label` takes the
 * token (`$primary-foreground`), the spinner needs the same colour as a value,
 * because React Native has no `currentColor` inheritance (`spinner.native.tsx`).
 */
const LABEL_COLOR = {
  primary: "primary-foreground",
  reserve: "primary-foreground",
  secondary: "accent-foreground",
  outline: "foreground",
  ghost: "foreground",
  destructive: "destructive-foreground",
} as const satisfies Record<ButtonVariant, ColorToken>;

/** `md` — a 44 px icon box; `sm` — a 32 px box inside the same 44 px target. */
export type ButtonIconSize = "sm" | "md";

/** Square icon boxes (toolbars) and round ones (row actions, e.g. accept / decline). */
export type ButtonIconShape = "square" | "round";

/** The drawn box of the icon-only mode; the 44 px target around it comes from the frame. */
const ICON_BOX_SIZE = { sm: 32, md: 44 } as const;

const Frame = styled(BehaviorFrame, {
  name: "GLButton",
  borderWidth: 1,
  borderColor: "transparent",
  paddingHorizontal: "$card-padding",
  borderRadius: "$md",
  cursor: "pointer",
  // The busy spinner's slot is absolutely positioned over the frame, so the frame
  // itself is the box it is centred on.
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
      // v8: the reserve action is the primary CTA — solid navy, like `primary`.
      reserve: {
        minHeight: "$control-height",
        backgroundColor: "$primary hover:$primary-hover",
        opacity: "press:0.9",
      },
      reserveBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$primary",
      },
      // `secondary`: the calm violet button of v8 (design-system secondary, not
      // outline): a translucent violet fill over whatever is behind it (`accent-soft`,
      // 18 % of accent.8) with a 1 px frame and accent text.
      secondary: {
        minHeight: "$control-height",
        backgroundColor: "$accent-soft hover:$accent-soft-hover",
        borderColor: "$accent-border",
        opacity: "press:0.9",
      },
      secondaryBlocked: {
        minHeight: "$control-height",
        backgroundColor: "$accent-soft",
        borderColor: "$accent-border",
      },
      // `outline`: the neutral bordered button (v8 outline) — secondary used to look like this.
      outline: {
        minHeight: "$control-height",
        backgroundColor: "transparent hover:$muted press:$muted",
        borderColor: "$border-strong hover:$foreground",
      },
      outlineBlocked: {
        minHeight: "$control-height",
        backgroundColor: "transparent",
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
      /**
       * Icon-only mode: the frame is only the 44 × 44 target, the look lives in the
       * icon box inside (`IconBox`). No fill, no frame, no paddings — exactly the
       * pressable surface an icon-only control had before it became a `Button`.
       */
      icon: {
        minHeight: "$touch-target",
        minWidth: "$touch-target",
        paddingHorizontal: 0,
        borderWidth: 0,
        borderRadius: 0,
        opacity: "press:0.9",
      },
      iconBlocked: {
        minHeight: "$touch-target",
        minWidth: "$touch-target",
        paddingHorizontal: 0,
        borderWidth: 0,
        borderRadius: 0,
      },
    },
    fullWidth: {
      true: { alignSelf: "stretch" },
    },
    inactive: {
      true: { opacity: 0.4, cursor: "default" },
    },
    busy: {
      true: {
        opacity: 0.6,
        cursor: "default",
        // The paddings stay the resting ones: the spinner is drawn over the
        // button, not laid out next to the label, so nothing has to be given back.
      },
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
      outline: { color: `$${LABEL_COLOR.outline}` },
      ghost: { color: `$${LABEL_COLOR.ghost}` },
      destructive: { color: `$${LABEL_COLOR.destructive}` },
    },
  } as const,
  defaultVariants: { variant: "primary" },
});

/**
 * The drawn box of the icon-only mode (`DESIGN.md` → Button → icon button): 44 × 44
 * with `iconSize="md"`, 32 × 32 with `sm` inside the same 44 px target, radius 8 or a
 * circle with `shape="round"`. `outline` keeps the 1 px `border` frame, `ghost` drops
 * it (the old `plain`), `primary` is the filled accept action. The icon draws with
 * `currentColor`, so the box colour is the ink of the glyph; the frame under it is a
 * transparent 44 px target (`icon` variant of `Frame`).
 */
const IconBox = styled(XStack, {
  name: "GLButtonIcon",
  alignItems: "center",
  justifyContent: "center",
  variants: {
    variant: {
      primary: {
        backgroundColor: "$primary hover:$primary-hover press:$primary-hover",
        color: `$${LABEL_COLOR.primary}`,
      },
      // v8: the reserve CTA is the primary one — same navy and same hover.
      reserve: {
        backgroundColor: "$primary hover:$primary-hover press:$primary-hover",
        color: `$${LABEL_COLOR.reserve}`,
      },
      secondary: {
        backgroundColor: "$accent-soft hover:$accent-soft-hover press:$accent-soft-hover",
        borderWidth: 1,
        borderColor: "$accent-border",
        color: `$${LABEL_COLOR.secondary}`,
      },
      outline: {
        borderWidth: 1,
        borderColor: "$border hover:$foreground",
        backgroundColor: "transparent hover:$muted press:$muted",
        color: `$${LABEL_COLOR.outline}`,
      },
      ghost: {
        borderWidth: 0,
        borderColor: "transparent",
        backgroundColor: "transparent hover:$muted press:$muted",
        color: `$${LABEL_COLOR.ghost}`,
      },
      destructive: {
        backgroundColor: "$destructive hover:$destructive-hover press:$destructive-hover",
        color: `$${LABEL_COLOR.destructive}`,
      },
    },
    iconSize: {
      sm: { width: ICON_BOX_SIZE.sm, height: ICON_BOX_SIZE.sm },
      md: { width: ICON_BOX_SIZE.md, height: ICON_BOX_SIZE.md },
    },
    shape: {
      square: { borderRadius: "$md" },
      round: { borderRadius: "$full" },
    },
  } as const,
  defaultVariants: { variant: "outline", iconSize: "md", shape: "square" },
});

/**
 * The busy spinner's slot (`t343u`, `t344u`): a box over the whole frame, out of
 * the row, so the spinner takes no room and the button keeps its resting width
 * and paddings. The spinner is centred on both axes; the box never takes a press,
 * so a button under the invisible slot (opacity 0 at rest) still reacts as usual.
 * The opacity goes 0 → 1 with the project's fade (`layerFade`, 160 ms, 100 ms with
 * «уменьшить движение»); the fade carries the spinner in, nothing shifts.
 */
const SpinnerSlot = styled(View, {
  name: "GLButtonSpinnerSlot",
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  variants: {
    busy: {
      true: { opacity: 1 },
      false: { opacity: 0 },
    },
  } as const,
  defaultVariants: { busy: false },
});

/** The button types the web honours; a phone ignores the value and stays a pressable. */
export const BUTTON_TYPES = ["button", "submit"] as const;

export type ButtonType = (typeof BUTTON_TYPES)[number];

/**
 * Props of `Button`. The catalogue prints these descriptions in the props table of
 * `UI/Button` (`button.stories.tsx` → `argTypes`): the React Native Web framework
 * has no TypeScript docgen, so the story repeats them for the table.
 */
export type ButtonProps = {
  /**
   * Required. The visible text and the accessible name (unless `ariaLabel` says
   * more). Copy comes from the caller. While `busy` it stays in the layout at
   * opacity 0 under the spinner, so the width does not change. In icon-only mode
   * (`icon`) it is not drawn: it is the accessible name only.
   */
  label: string;
  /**
   * An icon instead of the visible label: the button becomes an icon-only control,
   * 44 × 44 (`$touch-target`), with `label` as its accessible name and the glyph as
   * the picture. The `variant` paints the icon box: `ghost` is the old borderless
   * `plain`, `outline` keeps a 1 px `$border` frame, `primary` is the filled accept
   * action. Hover, press, focus and the blocked states follow the variant.
   */
  icon?: ReactNode;
  /**
   * The drawn box of an icon-only button: `md` is 44 × 44 (the default), `sm` is a
   * 32 × 32 box inside the same 44 px target. Ignored by a text button.
   */
  iconSize?: ButtonIconSize;
  /** `square` (radius 8, the default) or `round`; icon-only mode only. */
  shape?: ButtonIconShape;
  /**
   * The accessible name (`aria-label`) when it has to say more than the visible
   * label, e.g. a disabled button's reason. Defaults to `label`. The label hidden
   * under the busy spinner is not a second name.
   */
  ariaLabel?: string;
  /**
   * The id of the visible text that explains why the button is disabled; reaches
   * the web DOM as `aria-describedby`.
   */
  ariaDescribedBy?: string;
  /**
   * The same explanation for a phone screen reader: it reaches React Native as
   * `accessibilityHint`, which has no DOM equivalent. The web keeps reading the
   * visible text through `ariaDescribedBy`; the two are passed together, one per
   * platform (`a11y-hint.ts` / `a11y-hint.native.ts`).
   */
  hint?: string;
  /** Called on a live press only — never while `disabled` or `busy`. */
  onPress?: () => void;
  /**
   * Visual style and height. `primary`, `reserve`, `secondary`, `outline` and
   * `destructive` are at least 48 px tall (`$control-height`); `ghost` is at least
   * 44 × 44 px (`$touch-target`). There is no `size` prop.
   *
   * - `primary` — `$primary` fill → hover `$primary-hover` (8% darker) → press 90% opacity
   * - `reserve` — the same solid CTA as `primary` (only «Куплю сам» / «Подтвердить»)
   * - `secondary` — translucent `$accent-soft` fill with `$accent-border` frame → hover `$accent-soft-hover` → press 90% opacity
   * - `outline` — transparent with `$border-strong` frame → hover `$muted` fill and `$foreground` frame → press `$muted`
   * - `ghost` — transparent → hover `$muted` fill → press `$muted` fill
   * - `destructive` — `$destructive` fill → hover `$destructive-hover` → press 90% opacity
   *
   * In icon-only mode the same values paint the icon box; `outline` there takes the
   * `$border` token, and the press is the 90% opacity of the target, like a pressable.
   */
  variant?: ButtonVariant;
  /**
   * A native disabled button: leaves the Tab order (`tabIndex=-1`), is announced
   * with `aria-disabled`, dims to 40%, and takes no hover or press — a blocked
   * button keeps its resting look.
   */
  disabled?: boolean;
  /**
   * Keeps a disabled button in the Tab order: `aria-disabled` instead of the
   * `disabled` attribute, 40% opacity, no press.
   */
  focusableWhenDisabled?: boolean;
  /**
   * The action is running: keeps the resting paddings and width — the label stays
   * in the row at opacity 0 while a 16 px spinner is centred in an absolute slot
   * over it. Dims to 60%, is announced with `aria-busy`, stays in the Tab order,
   * takes no second press, and on the web `type` is reset to `button` so a form is
   * not submitted twice.
   */
  busy?: boolean;
  /** Stretches to the parent's width (`align-self: stretch`); the row stays centred. */
  fullWidth?: boolean;
  /**
   * A navigation target. On the web the root becomes a real `<a href>` with the
   * same look, so a page action that only navigates (registration, login, a public
   * page) keeps the browser's own click, new tab and context menu. A blocked button
   * stays a `<button>` and ignores the target. A phone has no anchor: the caller
   * hands navigation to the router.
   */
  href?: string;
  /** A stable handle for tests; reaches the web DOM as `data-testid`. */
  testID?: string;
  /**
   * `submit` submits the web button's form; a phone ignores it. Reset to `button`
   * while blocked, so a form is not submitted twice.
   */
  type?: ButtonType;
};

/**
 * The button of the app and of the Next pages (`DESIGN.md` → components
 * `button-primary`, `button-reserve`, `button-secondary`, `button-outline`,
 * `button-ghost`). On the web it is a real `<button>` (with `href`, a real
 * `<a href>`); a phone renders the same component through React Native.
 *
 * With `icon` it is the icon-only control of v8 (`IconButton` is a thin wrapper
 * over it): a 44 × 44 target, the icon box inside, `label` as the accessible name.
 *
 * The rules of every prop live in `ButtonProps` and are printed in the props table
 * of `UI/Button`; this comment stays the short summary.
 */
export const Button = forwardRef<ComponentRef<typeof Frame>, ButtonProps>(function Button(
  {
    label,
    icon,
    iconSize = "md",
    shape = "square",
    ariaLabel,
    ariaDescribedBy,
    hint,
    onPress,
    variant = "primary",
    disabled = false,
    focusableWhenDisabled = false,
    busy = false,
    fullWidth,
    href,
    testID,
    type = "button",
  },
  ref,
) {
  const blocked = disabled || busy;
  // `icon` turns the button into the icon-only control: the label stays the name,
  // the icon box carries the look and the frame is only the 44 px target.
  const iconOnly = icon !== undefined;
  // An anchor holds no disabled state: a blocked button keeps the `<button>` root
  // and only pretends to be one, so its `disabled` and `aria-disabled` stay honest.
  const link = href !== undefined && !blocked;
  // Tamagui's `View` props type has no `href`; the attribute is spread past it and
  // `render="a"` turns the root into the element that takes it (as `PersonRow`).
  const anchor = { href };
  // A blocked button must not react to hover or press (`DESIGN.md` → Состояния): it
  // takes the variant value without those states. Focus, clicks and the Tab order stay
  // as they are.
  const frameVariant = iconOnly
    ? blocked
      ? "iconBlocked"
      : "icon"
    : blocked
      ? BLOCKED_VARIANT[variant]
      : variant;
  // `busy` keeps the button in the Tab order (focus must not drop to <body> when a
  // form is submitted); only a plain `disabled` is a native disabled button.
  const native = disabled && !focusableWhenDisabled;
  // A blocked button never navigates and never submits: it is a plain button.
  const root = link ? (
    "a"
  ) : native ? (
    <button type="button" disabled />
  ) : (
    <button type={blocked ? "button" : type} />
  );
  // «Уменьшить движение»: the spinner slot fades in with the project's fade, 100 ms
  // instead of 160 ms (`motion.ts`), the same rule the layers follow.
  const reduce = useReduceMotion();
  // A live button lifts its fill, frame and opacity on hover with the `quick`
  // preset (160 ms); a blocked one keeps the resting look (CLE-129).
  const hover = hoverTransition(reduce);
  // The spinner needs a plain colour on a phone (no `currentColor`); the token is
  // the label's, so the arc matches its text in both themes (v8).
  const spinnerColor = useThemeColor(LABEL_COLOR[variant]);
  return (
    <Frame
      ref={ref}
      variant={frameVariant}
      fullWidth={fullWidth}
      inactive={disabled}
      busy={busy}
      {...(link ? anchor : {})}
      render={root}
      role={link ? "link" : "button"}
      tabIndex={native ? -1 : 0}
      aria-label={ariaLabel ?? label}
      {...a11yHintProps({ hint, describedBy: ariaDescribedBy })}
      aria-disabled={blocked}
      aria-busy={busy || undefined}
      data-testid={testID}
      testID={testID}
      transition={blocked ? null : hover}
      onPress={blocked ? undefined : onPress}
    >
      {/*
        The label stays in the row at opacity 0 while busy: it holds the width of
        the resting button. The name does not change — the frame's `aria-label`
        wins over the content — so the hidden text is not a second announcement.
        An icon-only button draws the box instead of the label; the box also stays
        at opacity 0 while busy, so the spinner takes its place without a shift.
      */}
      {iconOnly ? (
        <IconBox
          variant={variant}
          iconSize={iconSize}
          shape={shape}
          opacity={busy ? 0 : undefined}
          // A blocked button keeps its resting look: the transparent box under the
          // pointer must not take the hover of the icon box.
          pointerEvents={blocked ? "none" : undefined}
          transition={blocked ? null : hover}
          testID="button-icon"
          // A `<button>` may hold phrasing content only: the box is a `span` too.
          render={<span />}
        >
          {icon}
        </IconBox>
      ) : (
        <Label variant={variant} opacity={busy ? 0 : undefined}>
          {label}
        </Label>
      )}
      <SpinnerSlot
        busy={busy}
        transition={layerFade(reduce)}
        // A `<button>` may hold phrasing content only: the slot is a `span`, not a
        // block-level `div`. On a phone there are no tags and the slot stays a view.
        render={<span />}
      >
        {busy ? <Spinner color={spinnerColor} /> : null}
      </SpinnerSlot>
    </Frame>
  );
});

Button.displayName = "Button";
