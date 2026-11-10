import { createFont, createTamagui, createTokens } from "@tamagui/core";
import { animations } from "./animations";
import {
  breakpoints,
  colors,
  rounded,
  spacing,
  typography,
  type TypographyRole,
} from "./tokens";

/**
 * Font family names differ per runtime and are handed in by the app (the package
 * loads no fonts): expo-font face names in Expo, `next/font` CSS variables in Next.
 */
export type FontFamilies = {
  /** UI font (Manrope): `"Manrope"` or `"var(--font-sans)"`. */
  body: string;
  /** Display font (Lora): `"Lora"` or `"var(--font-heading)"`. */
  heading: string;
  /**
   * Native/Expo only: one loaded file per weight, because Android does not
   * synthesize weights and a weight next to a face name falls back to a system
   * font without Cyrillic. Omit on the web (`next/font` serves the weights).
   */
  bodyFaces?: Record<400 | 500 | 600, string>;
};

const ROLES = Object.keys(typography) as TypographyRole[];

function byRole<T>(pick: (role: TypographyRole) => T): Record<TypographyRole, T> {
  const out = {} as Record<TypographyRole, T>;
  for (const role of ROLES) out[role] = pick(role);
  return out;
}

/**
 * A font whose scale is keyed by DESIGN.md typography role, so a role is one
 * token: `fontSize="$caption" lineHeight="$caption"` (see `Text`).
 */
function createRoleFont(
  family: string,
  faces?: Record<number, { normal: string }>,
  /** The family is one loaded file (a weight in the file): the weight stays normal. */
  flat = false,
) {
  return createFont({
    family,
    size: byRole((role) => typography[role].fontSize),
    lineHeight: byRole((role) => typography[role].lineHeight),
    weight: byRole((role) => (flat ? "400" : typography[role].fontWeight)),
    letterSpacing: byRole((role) => typography[role].letterSpacing),
    ...(faces ? { face: faces } : {}),
  });
}

function sizeTokens(): Record<string, number> {
  const out: Record<string, number> = { 0: 0 };
  for (const [name, value] of Object.entries(spacing)) {
    if (!name.startsWith("bp-")) out[name] = value;
  }
  return out;
}

/** The 4-point scale: `$1`…`$6` = 4, 8, 12, 16, 24, 32, plus the named spacing. */
function spaceTokens(): Record<string, number> {
  return { ...sizeTokens(), 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };
}

const tokens = createTokens({
  color: colors,
  space: spaceTokens(),
  size: sizeTokens(),
  radius: { 0: 0, ...rounded },
  zIndex: { 0: 0, base: 1, layer: 100, toast: 200 },
});

/**
 * The only theme (`light`, UX-A8). Besides the DESIGN.md colors it carries the
 * keys the Tamagui components in use ask for (`tamagui/dialog`, `tamagui/sheet`
 * manifests): `color`, `color-5`, `shadow-color`, `border-color*`, `outline-color`.
 */
const light = {
  ...colors,
  color: colors.foreground,
  "color-5": colors["border-strong"],
  "shadow-color": colors.scrim,
  "background-hover": colors.muted,
  "background-press": colors.muted,
  "border-color": colors.border,
  "border-color-hover": colors["border-strong"],
  "border-color-focus": colors.ring,
  "outline-color": colors.ring,
};

export function createGiftListConfig(families: FontFamilies) {
  const faces = families.bodyFaces;
  const body = createRoleFont(
    families.body,
    faces
      ? {
          400: { normal: faces[400] },
          500: { normal: faces[500] },
          600: { normal: faces[600] },
        }
      : undefined,
  );
  const heading = createRoleFont(
    families.heading,
    faces
      ? { 400: { normal: families.heading }, 600: { normal: families.heading } }
      : undefined,
  );

  // Expo web: `face` is not applied there and `Manrope` is registered with the normal
  // weight only, so a weight is its own loaded family (`Manrope-600`) at a normal
  // weight, otherwise the browser draws a synthetic bold. Next serves all weights in
  // one family, so there the weights stay real. See `font-style.ts`.
  const flat = Boolean(faces);
  const body500 = createRoleFont(faces?.[500] ?? families.body, undefined, flat);
  const body600 = createRoleFont(faces?.[600] ?? families.body, undefined, flat);
  const display = createRoleFont(families.heading, undefined, flat);

  return createTamagui({
    tokens,
    animations,
    fonts: { body, heading, "body-500": body500, "body-600": body600, display },
    themes: { light },
    media: {
      medium: { minWidth: breakpoints.medium },
      expanded: { minWidth: breakpoints.expanded },
      wide: { minWidth: breakpoints.wide },
      // «Уменьшить движение» (DESIGN.md → Движение): web reads
      // `prefers-reduced-motion: reduce`, a phone reads
      // `AccessibilityInfo.isReduceMotionEnabled` through the Tamagui driver.
      reduce: { prefersReducedMotion: "reduce" },
    },
    settings: { defaultFont: "body" },
  });
}

export type GiftListConfig = ReturnType<typeof createGiftListConfig>;
