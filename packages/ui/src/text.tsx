import { Text as CoreText, styled, type GetProps } from "@tamagui/core";
import { fontFor } from "./font-style";
import { focusRing } from "./focus-ring";
import { typography, type TypographyRole } from "./tokens";

function roleStyle(role: TypographyRole) {
  // Lora for the display roles, Manrope for the rest; which loaded file carries the
  // weight is decided per platform in `fontFor`.
  return {
    ...fontFor(role),
    fontSize: `$${role}`,
    lineHeight: `$${role}`,
    letterSpacing: `$${role}`,
  } as const;
}

const kinds = Object.fromEntries(
  (Object.keys(typography) as TypographyRole[]).map((role) => [role, roleStyle(role)]),
) as Record<TypographyRole, ReturnType<typeof roleStyle>>;

/**
 * Text by DESIGN.md typography role (`kind`) and colour (`tone`). All sizes, line
 * heights, weights and letter spacing come from the theme.
 */
export const Text = styled(CoreText, {
  name: "GLText",
  color: "$foreground",
  variants: {
    kind: kinds,
    tone: {
      default: { color: "$foreground" },
      muted: { color: "$muted-foreground" },
      primary: { color: "$primary" },
      destructive: { color: "$destructive" },
      reserved: { color: "$status-reserved" },
      inverse: { color: "$primary-foreground" },
    },
  } as const,
  defaultVariants: { kind: "body", tone: "default" },
});

export type TextProps = Omit<GetProps<typeof Text>, "kind"> & { kind?: TypographyRole };

export type HeadingProps = Omit<TextProps, "role"> & {
  /** `aria-level`; screens use 1 for the page title, 2 for sections and layers. */
  level?: 1 | 2 | 3 | 4;
};

/** A heading for screen readers: `role="heading"` with an `aria-level`. */
export function Heading({ level = 2, kind = "heading", ...props }: HeadingProps) {
  return <Text kind={kind} role="heading" aria-level={level} {...props} />;
}

Heading.displayName = "Heading";

/**
 * The «Назад» / navigation link text (`DESIGN.md` → button, primary colour, 44 px
 * tall touch zone). Wrap it in the router's link, or give it `onPress`.
 *
 * Hover and keyboard focus are real CSS states: the menu-item background
 * (`nav-item.hover-background`) on hover, the `$ring` ring on `:focus-visible` only
 * (a mouse click must not leave a ring; a phone has no `:focus-visible` and takes
 * `focus`, `focus-ring.native.ts`), and the `opacity: 0.9` press feedback.
 */
export const LinkText = styled(CoreText, {
  name: "GLLinkText",
  ...roleStyle("button"),
  color: "$primary",
  backgroundColor: "transparent hover:$background",
  minHeight: "$touch-target",
  minWidth: "$touch-target",
  lineHeight: "$touch-target",
  cursor: "pointer",
  opacity: "press:0.9",
  ...focusRing,
});
