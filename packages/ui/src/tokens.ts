/**
 * v8 «Ночное небо»: every value of the DESIGN.md frontmatter (App and Next pages).
 * The single source of tokens for the whole repo: the Tamagui themes in
 * `config.ts` are built from these objects, and apps read numbers from here.
 *
 * Two themes with one set of names: `colors` is the light palette, `colorsDark`
 * repeats its keys for the dark one, so a component never asks which theme it is
 * in (styling comes from `$` tokens, `packages/ui/src/config.ts`).
 *
 * `lineHeight` is `fontSize × multiplier`, rounded to an integer.
 */

export const colors = {
  primary: "#2B3A7A",
  "primary-hover": "#1E2B69",
  "primary-foreground": "#FFFFFF",
  accent: "#EDEBF4",
  "accent-hover": "#E5E2F1",
  "accent-foreground": "#5B4C97",
  "accent-border": "#BAB4E0",
  "accent-soft": "rgba(157,149,213,0.18)",
  "accent-soft-hover": "rgba(157,149,213,0.27)",
  background: "#F3F1EC",
  foreground: "#1C1A2E",
  surface: "#FFFEFB",
  "surface-raised": "#FFFEFB",
  "switch-thumb": "#FFFFFF",
  muted: "#ECE7DF",
  "muted-foreground": "#56565C",
  border: "#DAD6CE",
  "border-strong": "#89888F",
  ring: "#2B3A7A",
  "ring-inverse": "#F3F1EC",
  "status-open": "#2C7352",
  "status-reserved": "#5B4C97",
  "status-reserved-bg": "#EEEDFD",
  "status-closed": "#56565C",
  success: "#2C7352",
  warning: "#7E4A42",
  destructive: "#C4473D",
  "destructive-hover": "#B1352D",
  "destructive-foreground": "#FFFFFF",
  scrim: "#1C1A2E",
} as const;

export type ColorToken = keyof typeof colors;

/** The `colors-dark` block: the same keys, the values of the dark theme. */
export type ThemeColors = Record<ColorToken, string>;

export const colorsDark: ThemeColors = {
  primary: "#7C8CFF",
  "primary-hover": "#8FA0FE",
  "primary-foreground": "#0E0E20",
  accent: "#373458",
  "accent-hover": "#413E64",
  "accent-foreground": "#C6BCEB",
  "accent-border": "#6F6895",
  "accent-soft": "rgba(180,167,224,0.18)",
  "accent-soft-hover": "rgba(180,167,224,0.25)",
  background: "#0E0E20",
  foreground: "#F3F1F8",
  surface: "#1B1B3A",
  "surface-raised": "#272642",
  "switch-thumb": "#F3F1F8",
  muted: "#272642",
  "muted-foreground": "#BABBD4",
  border: "#302F4B",
  "border-strong": "#717289",
  ring: "#7C8CFF",
  "ring-inverse": "#0E0E20",
  "status-open": "#A1D1B6",
  "status-reserved": "#C6BCEB",
  "status-reserved-bg": "#211E2A",
  "status-closed": "#BABBD4",
  success: "#A1D1B6",
  warning: "#E0B4AA",
  destructive: "#EE8A80",
  "destructive-hover": "#FC9C91",
  "destructive-foreground": "#0E0E20",
  scrim: "#06041A",
};

/**
 * v8 typography (`DESIGN.md` → frontmatter `typography`): Lora 600 for the headings
 * (`display`, `display-sm`, `heading`), Manrope for the UI. The role names are the
 * ones the components use; the sizes are the v8 scale mapped onto them.
 */
export const typography = {
  display: {
    fontFamily: "Lora",
    fontSize: 34,
    fontWeight: "600",
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  "display-sm": {
    fontFamily: "Lora",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: "Lora",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  "body-strong": {
    fontFamily: "Manrope",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    letterSpacing: 0,
  },
  body: {
    fontFamily: "Manrope",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
    letterSpacing: 0,
  },
  "body-sm": {
    fontFamily: "Manrope",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    letterSpacing: 0,
  },
  button: {
    fontFamily: "Manrope",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: 0,
  },
  label: {
    fontFamily: "Manrope",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: "Manrope",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
    letterSpacing: 0,
  },
} as const;

export type TypographyRole = keyof typeof typography;

/** v8 radii: 8 for controls, 16 for cards and dialogs, 20 for a sheet. */
export const rounded = {
  sm: 6,
  md: 8,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const spacing = {
  "page-gutter": 16,
  "page-gutter-lg": 24,
  "section-gap": 32,
  "card-padding": 16,
  "grid-gap": 16,
  "card-min": 280,
  "max-content": 720,
  "max-form": 560,
  "max-wide": 1120,
  sidebar: 264,
  "right-column": 300,
  "tab-bar": 56,
  header: 56,
  "touch-target": 44,
  "control-height": 48,
  "dialog-width": 480,
  "detail-width": 640,
  "column-gap": 24,
  "avatar-sm": 28,
  "avatar-md": 40,
  "avatar-lg": 64,
  "icon-nav": 24,
  "icon-inline": 20,
  "icon-small": 16,
  "pill-height": 24,
  "chip-height": 28,
  "row-height": 56,
  "photo-thumb": 72,
  "bp-medium": 600,
  "bp-expanded": 1024,
  "bp-wide": 1280,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Window-width breakpoints (`DESIGN.md` → App → Точки перехода). */
export const breakpoints = {
  medium: spacing["bp-medium"],
  expanded: spacing["bp-expanded"],
  wide: spacing["bp-wide"],
} as const;

export type ThemeName = "light" | "dark";

/**
 * v8 elevation (`DESIGN.md` → frontmatter `effects`). Light: two-layer soft shadows.
 * Dark: tone difference between layers carries the depth, the shadows are shallow.
 */
export const shadows = {
  light: {
    card: "0 1px 3px rgba(40,35,25,0.08), 0 12px 28px -4px rgba(40,35,25,0.08)",
    cardHover: "0 2px 4px rgba(40,35,25,0.10), 0 18px 36px -6px rgba(40,35,25,0.12)",
    popover: "0 2px 6px rgba(40,35,25,0.08), 0 24px 48px -12px rgba(40,35,25,0.18)",
  },
  dark: {
    card: "0 1px 2px rgba(4,4,20,0.4), 0 8px 24px -8px rgba(4,4,20,0.5)",
    cardHover: "0 12px 32px -8px rgba(4,4,20,0.6)",
    popover: "0 18px 48px -12px rgba(4,4,20,0.7)",
  },
} as const;

export type ShadowToken = keyof typeof shadows.light;

/**
 * v8 top-edge highlights (`DESIGN.md` → frontmatter `effects`): the inset line that
 * gives a card, a dialog and a button their volume, above all in the dark theme.
 */
export const highlights = {
  light: {
    card: "inset 0 1px 0 rgba(255,255,255,1)",
    modal: "inset 0 1px 0 rgba(255,255,255,1)",
    button: "inset 0 1px 0 rgba(255,255,255,0.22)",
  },
  dark: {
    card: "inset 0 1px 0 rgba(255,255,255,0.15)",
    modal: "inset 0 1px 0 rgba(255,255,255,0.18)",
    button: "inset 0 1px 0 rgba(255,255,255,0.15)",
  },
} as const;

export type HighlightToken = keyof typeof highlights.light;

/**
 * Layer scrim opacity (`DESIGN.md` → bottom-sheet, dialog: `scrim` at 40%). One
 * value for both themes: the dark scrim is the darker `colorsDark.scrim`.
 */
export const SCRIM_OPACITY = 0.4;
