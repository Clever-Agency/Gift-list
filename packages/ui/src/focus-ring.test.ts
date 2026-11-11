import { describe, expect, it } from "vitest";
import { focusRing, focusRingInverse } from "./focus-ring";

/**
 * The web half of the focus ring (`DESIGN.md` → «Кольцо фокуса», W12.9): the ring
 * is `$ring`, 2 px, offset 2 px, and every one of its properties hangs on the
 * `:focus-visible` state — a browser asks for it on keyboard navigation, not on a
 * mouse click. `focus-ring.native.test.tsx` checks the phone half and the DOM.
 */
describe("focus-ring (web): кольцо только на :focus-visible", () => {
  it("это кольцо $ring 2 px со сдвигом 2, без собственных размеров", () => {
    expect(focusRing).toEqual({
      outlineColor: "focus-visible:$ring",
      outlineStyle: "focus-visible:solid",
      outlineWidth: "focus-visible:2px",
      outlineOffset: 2,
    });
  });

  it("каждый цвет, стиль и толщина — состояние focus-visible, а не голый focus", () => {
    const values: [string, string][] = [
      ["outlineColor", focusRing.outlineColor],
      ["outlineStyle", focusRing.outlineStyle],
      ["outlineWidth", focusRing.outlineWidth],
    ];
    for (const [property, value] of values) {
      expect(value, property).toMatch(/^focus-visible:/);
      expect(value, property).not.toMatch(/^focus:/);
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

  it("inverse-кольцо тоста — тот же :focus-visible, но $ring-inverse", () => {
    expect(focusRingInverse).toEqual({ outlineColor: "focus-visible:$ring-inverse" });
  });
});
