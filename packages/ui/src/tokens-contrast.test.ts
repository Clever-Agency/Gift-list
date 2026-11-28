// @vitest-environment node
import { describe, expect, it } from "vitest";
import { colors, colorsDark, type ColorToken, type ThemeColors } from "./tokens";

/**
 * CLE-135 (Story 6.4, NFR-5): the palette keeps WCAG 2.1 AA in both themes.
 *
 * Text needs 4.5:1 (1.4.3), borders and focus rings that identify a control need
 * 3:1 (1.4.11). The pairs below are the ones the components actually paint; the
 * ratios were audited in `A1-report.md`. `border` is left out on purpose:
 * `DESIGN.md` calls it a decorative hairline (1.44:1), and a card is identified
 * by its text, not by that line.
 *
 * A token change that breaks a pair fails this test. The list of known failures
 * below is the debt register: every entry must still fail, so fixing one means
 * deleting it from the list — the test cannot quietly keep a fixed pair there.
 */

type Pair = readonly [ColorToken, ColorToken];

type ThemeName = "light" | "dark";

type Theme = { name: ThemeName; palette: ThemeColors };

const THEMES: readonly Theme[] = [
  { name: "light", palette: colors },
  { name: "dark", palette: colorsDark },
];

/** Text pairs the palette promises to keep readable: ink on paper, surface, muted. */
const TEXT_PAIRS: readonly Pair[] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted-foreground", "background"],
  ["muted-foreground", "surface"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "surface"],
  ["accent-foreground", "accent"],
  ["primary-foreground", "primary"],
  ["destructive", "surface"],
  // The error ink of every field, menu and label (`Text` → tone `destructive`).
  ["destructive-hover", "background"],
  ["destructive-hover", "surface"],
  ["destructive-hover", "muted"],
  ["destructive-foreground", "destructive"],
  ["destructive-foreground", "destructive-hover"],
  ["status-open", "surface"],
  ["status-open", "background"],
  ["status-reserved", "surface"],
  ["status-reserved", "background"],
  ["status-reserved", "status-reserved-bg"],
  ["status-closed", "surface"],
  ["warning", "surface"],
  ["warning", "background"],
  ["success", "surface"],
];

/** Borders and focus rings: information needed to identify a control (1.4.11). */
const BORDER_PAIRS: readonly Pair[] = [
  ["border-strong", "surface"],
  ["border-strong", "background"],
  ["ring", "surface"],
  ["ring", "background"],
];

/**
 * Known failures, kept as an explicit exception list until the designer decides.
 * Each one must still fail: a fixed pair has to leave this list.
 */
const DEBTS: ReadonlyArray<{ theme: ThemeName; pair: Pair; min: number; why: string }> = [
  {
    theme: "light",
    pair: ["accent-border", "surface"],
    min: 3,
    why: "рамка secondary-кнопки на surface — 1.95:1; кнопку называет текст — дизайн-решение, Сергей",
  },
  {
    theme: "light",
    pair: ["accent-border", "background"],
    min: 3,
    why: "рамка secondary-кнопки на бумаге — 1.74:1 — дизайн-решение, Сергей",
  },
  {
    theme: "light",
    pair: ["destructive", "background"],
    min: 4.5,
    why: "текст $destructive на бумаге — 4.31:1; компоненты рисуют $destructive-hover, значение палитры — дизайн-решение, Сергей",
  },
  {
    theme: "light",
    pair: ["destructive", "muted"],
    min: 4.5,
    why: "текст $destructive на muted — 3.95:1; значение палитры — дизайн-решение, Сергей",
  },
];

/** One sRGB channel of `#RRGGBB`, linearised (WCAG 2.1, relative luminance). */
function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4);
}

/** WCAG contrast ratio of two `#RRGGBB` colours, 1…21. */
function contrast(foreground: string, background: string): number {
  const one = luminance(foreground);
  const two = luminance(background);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/** The ratio of a pair of theme tokens; both must be plain hex (no alpha). */
function ratio(palette: ThemeColors, [foreground, background]: Pair): number {
  const one = palette[foreground];
  const two = palette[background];
  expect(one, `${foreground}: hex-токен`).toMatch(/^#[0-9A-F]{6}$/i);
  expect(two, `${background}: hex-токен`).toMatch(/^#[0-9A-F]{6}$/i);
  return contrast(one, two);
}

describe("tokens: контраст AA в обеих темах (NFR-5)", () => {
  it("текст держит 4.5:1 на бумаге, surface и muted", () => {
    for (const theme of THEMES) {
      for (const pair of TEXT_PAIRS) {
        expect(ratio(theme.palette, pair), `${theme.name}: ${pair[0]} на ${pair[1]}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  it("границы и кольцо фокуса держат 3:1", () => {
    for (const theme of THEMES) {
      for (const pair of BORDER_PAIRS) {
        expect(ratio(theme.palette, pair), `${theme.name}: ${pair[0]} на ${pair[1]}`).toBeGreaterThanOrEqual(
          3,
        );
      }
    }
  });

  it("известные долги остаются исключениями и всё ещё не проходят", () => {
    for (const debt of DEBTS) {
      const palette = debt.theme === "light" ? colors : colorsDark;
      const value = ratio(palette, debt.pair);
      expect(value, `${debt.theme}: ${debt.pair[0]} на ${debt.pair[1]} (нужно ${debt.min}:1) — ${debt.why}`).toBeLessThan(
        debt.min,
      );
    }
  });
});
