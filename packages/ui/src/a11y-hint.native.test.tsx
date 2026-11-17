// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * The phone half of the platform pair. Every component here imports `./a11y-hint`;
 * the mock below swaps that module for its `.native` variant, so the components
 * run with the props a phone would receive. Tamagui's web view keeps an unknown
 * prop as an attribute, which is how the test sees the value; this is a unit
 * check of the wiring, not a TalkBack/VoiceOver run on a device.
 */
vi.mock("./a11y-hint", async () => await import("./a11y-hint.native"));

import { a11yHintProps } from "./a11y-hint.native";
import { Choice, ChoiceList } from "./choice";
import { TagChip } from "./tag-chip";
import { createMount } from "./test-utils";
import { TextField } from "./text-field";

const mounted = createMount();

function noop() {}

describe("a11y-hint (native): подсказка для скринридера", () => {
  it("отдаёт accessibilityHint с текстом подсказки", () => {
    expect(a11yHintProps({ hint: "До 254 символов" })).toEqual({
      accessibilityHint: "До 254 символов",
    });
  });

  it("отдаёт склеенную подсказку радио целиком", () => {
    expect(a11yHintProps({ hint: "Видно всем. Выберите видимость" })).toEqual({
      accessibilityHint: "Видно всем. Выберите видимость",
    });
  });

  it("без текста не отдаёт accessibilityHint", () => {
    expect(a11yHintProps({})).toEqual({});
    expect(a11yHintProps({ describedBy: "field-description" })).toEqual({});
  });

  it("не отдаёт веб-атрибут aria-describedby: на телефоне его нет", () => {
    expect(a11yHintProps({ hint: "До 254 символов" })).not.toHaveProperty("aria-describedby");
  });
});

describe("a11y-hint (native): компоненты по-прежнему отдают hint", () => {
  it("поле, радио, группа и чип получают прежний текст в accessibilityHint", async () => {
    // The phone does not know `aria-describedby`; React warns about the DOM
    // attribute in this simulation, so the output is silenced deliberately.
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <>
          <TextField label="Почта" value="" onChangeText={noop} hint="До 254 символов" />
          <ChoiceList label="Кто видит" variant="row" error="Выберите видимость">
            <Choice variant="row" label="Всем" hint="Видно всем" selected onPress={noop} />
          </ChoiceList>
          <TagChip
            label="мечта"
            selected
            onPress={noop}
            error={{ id: "tags-error", message: "Проверьте теги" }}
          />
        </>,
      );

      const input = container.querySelector("input") as HTMLElement;
      expect(input.getAttribute("accessibilityhint")).toBe("До 254 символов");
      const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
      expect(radiogroup.getAttribute("accessibilityhint")).toBe("Выберите видимость");
      const radio = container.querySelector('[role="radio"]') as HTMLElement;
      expect(radio.getAttribute("accessibilityhint")).toBe("Видно всем. Выберите видимость");
      const chip = container.querySelector('[role="checkbox"]') as HTMLElement;
      expect(chip.getAttribute("accessibilityhint")).toBe("Проверьте теги");
      // Связка через id — только веб-канал: на телефоне её нет.
      expect(container.querySelectorAll("[aria-describedby]")).toHaveLength(0);
    } finally {
      errors.mockRestore();
    }
  });
});
