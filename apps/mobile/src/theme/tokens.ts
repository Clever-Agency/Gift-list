/**
 * Forest Paper tokens from DESIGN.md frontmatter (App).
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
  },
  "body-strong": {
    fontFamily: "Manrope",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  body: {
    fontFamily: "Manrope",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  },
  button: {
    fontFamily: "Manrope",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 18,
  },
  label: {
    fontFamily: "Manrope",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  caption: {
    fontFamily: "Manrope",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  },
} as const;

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

export type TypographyRole = keyof typeof typography;

type FontWeight = "400" | "500" | "600";

/** Loaded face names. One file per weight — Android does not synthesize them. */
function faceFor(token: { fontFamily: string; fontWeight: FontWeight }): string {
  if (token.fontFamily === "Lora") return "Lora";
  if (token.fontWeight === "500") return "Manrope-500";
  if (token.fontWeight === "600") return "Manrope-600";
  return "Manrope";
}

export function textStyle(role: TypographyRole): {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
} {
  const token = typography[role];
  const letterSpacing = "letterSpacing" in token ? token.letterSpacing : undefined;
  // Weight is encoded in the loaded face name. Setting fontWeight as well makes
  // Android look up a different file and fall back to a system font without Cyrillic.
  return {
    fontFamily: faceFor(token),
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    ...(letterSpacing !== undefined ? { letterSpacing } : {}),
  };
}
