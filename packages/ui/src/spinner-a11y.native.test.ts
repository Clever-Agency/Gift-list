import { describe, expect, it } from "vitest";
import { spinnerA11yProps } from "./spinner-a11y.native";

/**
 * The native branch of the busy spinner. Vitest resolves a bare import to the
 * web module, so the `.native` file is imported explicitly, as in
 * `password-toggle-a11y.native.test.ts`. This is a unit check of the props the
 * phone receives — not a TalkBack/VoiceOver run on a device.
 */
describe("Spinner (native): скрыт от скринридера", () => {
  it("iOS прячет поддерево через accessibilityElementsHidden", () => {
    expect(spinnerA11yProps()).toMatchObject({ accessibilityElementsHidden: true });
  });

  it("Android прячет поддерево через importantForAccessibility", () => {
    expect(spinnerA11yProps()).toMatchObject({
      importantForAccessibility: "no-hide-descendants",
    });
  });

  it("не отдаёт веб-атрибут aria-hidden: на native его нет", () => {
    expect(spinnerA11yProps()).not.toHaveProperty("aria-hidden");
  });
});
