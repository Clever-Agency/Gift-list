// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGiftListConfig } from "./config";
import { colors, colorsDark, highlights, rounded, shadows, spacing, typography } from "./tokens";

const DESIGN = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md",
);

function readFile(): string {
  return readFileSync(DESIGN, "utf8").split(String.fromCharCode(13)).join("");
}

/** The `key: value` lines of one top-level block of the DESIGN.md frontmatter. */
function frontmatterBlock(name: string): Record<string, string> {
  const text = readFile();
  const frontmatter = text.split("\n---\n")[0] ?? "";
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line === `${name}:`);
  const block: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = /^ {2}([a-z-]+):\s*(?:'([^']*)'|([^'#\s][^#]*?))\s*(?:#.*)?$/.exec(line);
    const value = match?.[2] ?? match?.[3];
    if (match?.[1] && value !== undefined) block[match[1]] = value;
  }
  return block;
}

/** `cardHover` → `card-hover`, the spelling of the frontmatter keys. */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** A theme entry as a plain value: Tamagui hands colours as variables (`.val`). */
function themeValue(theme: Record<string, unknown>, name: string): unknown {
  const value = theme[name];
  if (typeof value === "object" && value !== null && "val" in value) {
    return (value as { val: unknown }).val;
  }
  return value;
}

describe("tokens: значения DESIGN.md", () => {
  it("цвета совпадают с frontmatter", () => {
    const expected = frontmatterBlock("colors");
    expect(Object.keys(expected).length).toBeGreaterThan(15);
    expect(colors).toEqual(expected);
  });

  it("тёмная палитра: те же ключи, значения из блока colors-dark", () => {
    const expected = frontmatterBlock("colors-dark");
    expect(Object.keys(expected).length).toBeGreaterThan(15);
    expect(Object.keys(expected).sort()).toEqual(Object.keys(colors).sort());
    expect(colorsDark).toEqual(expected);
  });

  it("радиусы совпадают с frontmatter", () => {
    const expected = Object.fromEntries(
      Object.entries(frontmatterBlock("rounded")).map(([key, value]) => [key, parseInt(value, 10)]),
    );
    expect(rounded).toEqual(expected);
  });

  it("тени и блики совпадают с блоком effects", () => {
    const expected = frontmatterBlock("effects");
    const actual: Record<string, string> = {};
    for (const theme of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(shadows[theme])) {
        actual[`shadow-${kebab(name)}-${theme}`] = value;
      }
      for (const [name, value] of Object.entries(highlights[theme])) {
        actual[`highlight-${name}-${theme}`] = value;
      }
    }
    expect(actual).toEqual(expected);
  });

  it("отступы и размеры совпадают с frontmatter", () => {
    const expected = Object.fromEntries(
      Object.entries(frontmatterBlock("spacing")).map(([key, value]) => [key, parseInt(value, 10)]),
    );
    expect(Object.keys(expected).length).toBeGreaterThan(30);
    expect(spacing).toEqual(expected);
  });

  it("типографика: размер и вес из frontmatter, интерлиньяж — размер × множитель", () => {
    const text = readFile().split("\n---\n")[0] ?? "";
    for (const [role, token] of Object.entries(typography)) {
      const section = new RegExp(`\\n  ${role}:\\n((?:    .*\\n)+)`).exec(text)?.[1] ?? "";
      const size = Number(/fontSize: (\d+)px/.exec(section)?.[1]);
      const weight = /fontWeight: '(\d+)'/.exec(section)?.[1];
      const multiplier = Number(/lineHeight: '([\d.]+)'/.exec(section)?.[1]);
      expect(token.fontSize, role).toBe(size);
      expect(token.fontWeight, role).toBe(weight);
      expect(token.lineHeight, role).toBe(Math.round(size * multiplier));
    }
  });
});

describe("config: темы", () => {
  const config = createGiftListConfig({ body: "Manrope", heading: "Lora" });

  it("светлая и тёмная темы со всеми цветами DESIGN.md", () => {
    expect(Object.keys(config.themes)).toEqual(["light", "dark"]);
    const light = config.themes.light as unknown as Record<string, unknown>;
    const dark = config.themes.dark as unknown as Record<string, unknown>;
    for (const name of Object.keys(colors)) {
      expect(light[name], `light: ${name}`).toBeDefined();
      expect(dark[name], `dark: ${name}`).toBeDefined();
    }
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it("тёмная тема берёт значения блока colors-dark", () => {
    const dark = config.themes.dark as unknown as Record<string, unknown>;
    expect(themeValue(dark, "background")).toBe(colorsDark.background);
    expect(themeValue(dark, "surface")).toBe(colorsDark.surface);
    expect(themeValue(dark, "primary")).toBe(colorsDark.primary);
    expect(themeValue(dark, "color")).toBe(colorsDark.foreground);
  });

  it("тема несёт тень карточки v8 как одно значение", () => {
    for (const name of ["light", "dark"] as const) {
      const theme = config.themes[name] as unknown as Record<string, unknown>;
      // The highlight and the two card layers of the `effects` block, one string.
      expect(themeValue(theme, "shadow-card")).toBe(
        [highlights[name].card, shadows[name].card].join(", "),
      );
      expect(themeValue(theme, "shadow-card-hover")).toBe(
        [highlights[name].card, shadows[name].cardHover].join(", "),
      );
    }
  });

  it("в теме есть ключи, которых ждут Dialog и Sheet", () => {
    for (const themeName of ["light", "dark"] as const) {
      const theme = config.themes[themeName] as unknown as Record<string, unknown>;
      for (const key of [
        "background",
        "border-color",
        "color-5",
        "shadow-color",
        "color",
        "outline-color",
      ]) {
        expect(theme[key], `${themeName}: ${key}`).toBeDefined();
      }
    }
  });

  it("токен true не используется", () => {
    for (const group of ["size", "space", "radius", "zIndex"] as const) {
      expect(Object.keys(config.tokens[group]), group).not.toContain("true");
    }
  });
});
