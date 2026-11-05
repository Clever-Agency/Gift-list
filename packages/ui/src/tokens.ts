/**
 * Forest Paper: every value of the DESIGN.md frontmatter (App and Next pages).
 * The single source of tokens for the whole repo: the Tamagui theme in
 * `config.ts` is built from these objects, and apps read numbers from here.
 *
 * `lineHeight` is `fontSize × multiplier`, rounded to an integer.
 * Display `letterSpacing` is `-0.01em` of 36px = -0.36.
 */

export const colors = {
  primary: "#2F5D3A",
  "primary-foreground": "#F7FAF7",
  accent: "#D4A017",
  "accent-foreground": "#1E241F",
  background: "#F4F1EA",
  foreground: "#1E241F",
  surface: "#FFFFFF",
  muted: "#E8E4DA",
  "muted-foreground": "#5C6358",
  border: "#D9D3C6",
  "border-strong": "#8F8673",
  ring: "#2F5D3A",
  "ring-inverse": "#F4F1EA",
  "status-open": "#2F5D3A",
  "status-reserved": "#7A5E07",
  "status-reserved-bg": "#F5E6B8",
  "status-closed": "#5C6358",
  destructive: "#B42318",
  "destructive-foreground": "#FFFFFF",
  scrim: "#1E241F",
} as const;

export type ColorToken = keyof typeof colors;

export const typography = {
  display: {
    fontFamily: "Lora",
    fontSize: 36,
    fontWeight: "600",
    lineHeight: 41,
    letterSpacing: -0.36,
  },
  "display-sm": {
    fontFamily: "Lora",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 29,
    letterSpacing: 0,
  },
  heading: {
    fontFamily: "Manrope",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 23,
    letterSpacing: 0,
  },
  "body-strong": {
    fontFamily: "Manrope",
    fontSize: 16,
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
  button: {
    fontFamily: "Manrope",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 18,
    letterSpacing: 0,
  },
  label: {
    fontFamily: "Manrope",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
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

export const rounded = {
  sm: 6,
  md: 10,
  lg: 14,
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

/** Layer scrim opacity (`DESIGN.md` → bottom-sheet, dialog: `scrim` at 40%). */
export const SCRIM_OPACITY = 0.4;
