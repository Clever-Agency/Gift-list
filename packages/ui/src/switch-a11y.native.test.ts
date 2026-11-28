import { describe, expect, it } from "vitest";
import { switchA11yProps } from "./switch-a11y.native";

/**
 * The native branch of the switch state. Vitest resolves a bare import to the
 * web module, so the `.native` file is imported explicitly, as in
 * `spinner-a11y.native.test.ts`. This is a unit check of the props the phone
 * receives — not a TalkBack/VoiceOver run on a device.
 */
describe("Switch (native): состояние для скринридера", () => {
  it("on отдаёт accessibilityState.checked = true", () => {
    expect(switchA11yProps({ checked: true })).toEqual({
      accessibilityState: { checked: true, disabled: false },
    });
  });

  it("off отдаёт accessibilityState.checked = false", () => {
    expect(switchA11yProps({ checked: false })).toEqual({
      accessibilityState: { checked: false, disabled: false },
    });
  });

  it("disabled входит в то же состояние: переключатель объявлен недоступным", () => {
    expect(switchA11yProps({ checked: true, disabled: true })).toEqual({
      accessibilityState: { checked: true, disabled: true },
    });
  });

  it("не отдаёт веб-атрибут aria-checked: на телефоне его нет", () => {
    expect(switchA11yProps({ checked: true })).not.toHaveProperty("aria-checked");
  });
});
