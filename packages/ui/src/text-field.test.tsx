// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createMount } from "./test-utils";
import { PasswordField, TextField } from "./text-field";

const mounted = createMount();

function noop() {}

describe("TextField", () => {
  it("подпись связана с полем, текст ошибки — с полем для диктора", async () => {
    const { container, render } = mounted();
    await render(
      <TextField label="Эл. почта" value="" onChangeText={noop} error="Введите адрес" />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    const label = container.querySelector("label") as HTMLLabelElement;
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const error = document.getElementById(describedBy as string);
    expect(error?.textContent).toBe("Введите адрес");
    expect(error?.getAttribute("role")).toBe("alert");
  });

  it("подсказка показывается, пока нет ошибки, и не объявляется как alert", async () => {
    const { container, render } = mounted();
    await render(
      <TextField label="Название" value="" onChangeText={noop} hint="До 80 символов" />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const hint = document.getElementById(input.getAttribute("aria-describedby") as string);
    expect(hint?.textContent).toBe("До 80 символов");
    expect(hint?.getAttribute("role")).toBeNull();
  });

  it("ввод вызывает onChangeText со строкой", async () => {
    const onChangeText = vi.fn();
    const { container, render } = mounted();
    await render(<TextField label="Название" value="" onChangeText={onChangeText} />);

    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Плед");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChangeText).toHaveBeenCalledWith("Плед");
  });

  it("multiline рисует textarea", async () => {
    const { container, render } = mounted();
    await render(<TextField label="Описание" value="" onChangeText={noop} multiline rows={4} />);

    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("пустая строка ошибки не прячет подсказку", async () => {
    const { container, render } = mounted();
    await render(
      <TextField label="Ник" value="" onChangeText={noop} error="" hint="От 3 до 20 символов" />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const described = document.getElementById(input.getAttribute("aria-describedby") as string);
    expect(described?.textContent).toBe("От 3 до 20 символов");
    expect(described?.getAttribute("role")).toBeNull();
  });
});

describe("PasswordField", () => {
  it("скрывает текст и по кнопке показывает его", async () => {
    const { container, render } = mounted();
    await render(
      <PasswordField label="Пароль" value="secret" onChangeText={noop} showLabel="Показать" />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");

    const reveal = container.querySelector("[aria-label='Показать']") as HTMLElement;
    expect(reveal.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      reveal.click();
    });
    expect((container.querySelector("input") as HTMLInputElement).type).toBe("text");
    const revealed = container.querySelector("[aria-label='Показать']") as HTMLElement;
    expect(revealed.getAttribute("aria-pressed")).toBe("true");
  });
});
