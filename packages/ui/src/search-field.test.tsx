// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./text-field";
import { createMount } from "./test-utils";

const mounted = createMount();

function noop() {}

describe("SearchField", () => {
  it("подписывает поле и показывает плейсхолдер «Имя или @ник»", async () => {
    const { container, render } = mounted();
    await render(
      <SearchField
        label="Имя или @ник"
        placeholder="Имя или @ник"
        value=""
        onChangeText={noop}
        clearLabel="Очистить"
      />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Имя или @ник");
    expect(input.getAttribute("placeholder")).toBe("Имя или @ник");
  });

  it("без текста крестика нет: очищать нечего", async () => {
    const { container, render } = mounted();
    await render(
      <SearchField
        label="Имя или @ник"
        placeholder="Имя или @ник"
        value=""
        onChangeText={noop}
        clearLabel="Очистить"
      />,
    );

    expect(container.querySelector('[aria-label="Очистить"]')).toBeNull();
  });

  it("крестик с текстом очищает поле и не отправляет форму", async () => {
    const onChangeText = vi.fn();
    const { container, render } = mounted();
    await render(
      <SearchField
        label="Имя или @ник"
        placeholder="Имя или @ник"
        value="@alena"
        onChangeText={onChangeText}
        clearLabel="Очистить"
      />,
    );

    const clear = container.querySelector('[aria-label="Очистить"]');
    expect(clear).not.toBeNull();

    await act(async () => {
      clear?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChangeText).toHaveBeenCalledWith("");
  });

  it("передаёт ввод наружу строкой", async () => {
    const onChangeText = vi.fn();
    const { container, render } = mounted();
    await render(
      <SearchField
        label="Имя или @ник"
        placeholder="Имя или @ник"
        value=""
        onChangeText={onChangeText}
        clearLabel="Очистить"
        input={{ maxLength: 50 }}
      />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("maxlength")).toBe("50");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Аня");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onChangeText).toHaveBeenCalledWith("Аня");
  });

  it("иконки декоративные: у них нет роли и подписи", async () => {
    const { container, render } = mounted();
    await render(
      <SearchField
        label="Имя или @ник"
        placeholder="Имя или @ник"
        value="alena"
        onChangeText={noop}
        clearLabel="Очистить"
      />,
    );

    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});
