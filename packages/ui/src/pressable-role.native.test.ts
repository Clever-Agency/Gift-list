import { describe, expect, it } from "vitest";
import { pressableRole } from "./pressable-role.native";

/**
 * The phone half of the shared `Pressable` role (W12.10). Vitest resolves
 * `./pressable-role` to the web module, so the `.native` file is imported
 * explicitly, as in `focus-ring.native.test.ts`. The module is a plain object and
 * imports nothing from `react-native`, so this reads the props a phone would
 * receive — it is a unit check, not a TalkBack/VoiceOver run on a device.
 */
describe("Pressable (native): роль по умолчанию", () => {
  it("дефолт — accessibilityRole button, а role не задан", () => {
    expect(pressableRole).toEqual({ accessibilityRole: "button" });
    expect(pressableRole).not.toHaveProperty("role");
  });

  it("role вызывающего сохраняется и по-прежнему побеждает на телефоне", () => {
    // The merge semantics of Tamagui (`mergeComponentProps`): the caller's layer
    // replaces a styled default, and React Native resolves `role` before
    // `accessibilityRole` (`AccessibilityProps.cpp:20-28`), so `radio` stays radio.
    const props = { ...pressableRole, role: "radio" as const };
    expect(props.role).toBe("radio");
    expect(props.accessibilityRole).toBe("button");
  });

  it("accessibilityRole вызывающего перекрывает дефолт: togglebutton достижим", () => {
    const props = { ...pressableRole, accessibilityRole: "togglebutton" as const };
    expect(props.accessibilityRole).toBe("togglebutton");
    expect(props).not.toHaveProperty("role");
  });

  it("не отдаёт веб-атрибут role: на телефоне он перекрыл бы accessibilityRole", () => {
    expect(Object.keys(pressableRole)).toEqual(["accessibilityRole"]);
  });
});
