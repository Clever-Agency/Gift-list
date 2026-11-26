import { describe, expect, it } from "vitest";
import { hoverTransition } from "./hover";

/**
 * CLE-129: one transition for every hover in the package — the `quick` preset of
 * the CSS driver (160 ms), only the properties a hover paints, and nothing at all
 * with «уменьшить движение».
 */
describe("hoverTransition", () => {
  it("без reduce: пресет quick и только цвета, тень и прозрачность", () => {
    const transition = hoverTransition(false);
    expect(transition).toMatchObject({ preset: "quick" });
    const properties = String((transition as { properties?: string }).properties);
    for (const property of ["backgroundColor", "borderColor", "boxShadow", "opacity", "color"]) {
      expect(properties, property).toContain(property);
    }
    // A layout change must never glide.
    expect(properties).not.toContain("all");
  });

  it("под reduce: перехода нет", () => {
    expect(hoverTransition(true)).toBeNull();
  });
});
