import { describe, expect, it } from "vitest";
import { focusRing } from "./focus-ring.native";

/**
 * The phone half of the focus ring (`DESIGN.md` → «Кольцо фокуса», W12.9).
 * `:focus-visible` never comes on in React Native, so the same ring follows
 * `focus` — an external keyboard or a screen reader on the surface. The module is
 * a plain object and imports nothing from `react-native`, so the test reads the
 * props a phone would receive; the wiring is checked in `focus-ring.native.test.tsx`.
 * This is a unit check, not a run on a device with a hardware keyboard.
 */
describe("focus-ring (native): кольцо по focus", () => {
  it("это то же кольцо $ring 2 px со сдвигом 2, но на состоянии focus", () => {
    expect(focusRing).toEqual({
      outlineColor: "focus:$ring",
      outlineStyle: "focus:solid",
      outlineWidth: "focus:2px",
      outlineOffset: 2,
    });
  });

  it("состояния focus-visible в нём нет: на телефоне оно не наступает", () => {
    const values: [string, string][] = [
      ["outlineColor", focusRing.outlineColor],
      ["outlineStyle", focusRing.outlineStyle],
      ["outlineWidth", focusRing.outlineWidth],
    ];
    for (const [property, value] of values) {
      expect(value, property).toMatch(/^focus:/);
      expect(value, property).not.toMatch(/^focus-visible:/);
    }
  });

  it("раскладку не двигает: сдвиг кольца — outlineOffset, а не padding или margin", () => {
    expect(Object.keys(focusRing).sort()).toEqual([
      "outlineColor",
      "outlineOffset",
      "outlineStyle",
      "outlineWidth",
    ]);
    expect(focusRing.outlineOffset).toBe(2);
  });
});
