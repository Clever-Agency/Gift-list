import { describe, expect, it } from "vitest";
import { passwordToggleA11yProps } from "./password-toggle-a11y.native";

/**
 * The native branch of the password reveal toggle. `Vitest` resolves a bare
 * import to the web module, so the `.native` file is imported explicitly, as in
 * `focus.native.test.ts`. This is a unit check of the props the phone receives —
 * not a TalkBack/VoiceOver run on a device.
 */
describe("PasswordField (native): состояние переключателя для скринридера", () => {
  it("скрытый пароль — togglebutton с checked: false", () => {
    expect(passwordToggleA11yProps(false)).toEqual({
      accessibilityRole: "togglebutton",
      accessibilityState: { checked: false },
    });
  });

  it("видимый пароль — togglebutton с checked: true", () => {
    expect(passwordToggleA11yProps(true)).toEqual({
      accessibilityRole: "togglebutton",
      accessibilityState: { checked: true },
    });
  });

  it("role не отдаётся: на телефоне он перекрыл бы togglebutton", () => {
    expect(passwordToggleA11yProps(true)).not.toHaveProperty("role");
    expect(passwordToggleA11yProps(false)).not.toHaveProperty("role");
  });

  it("не отдаёт веб-атрибут aria-pressed: на native его нет", () => {
    expect(passwordToggleA11yProps(true)).not.toHaveProperty("aria-pressed");
    expect(passwordToggleA11yProps(false)).not.toHaveProperty("aria-pressed");
  });
});
