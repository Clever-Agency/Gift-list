// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createMount, errorMessages, nativeOnlyAttributes } from "./test-utils";
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

  it("не отдаёт нативный hint в DOM: подсказка и ошибка остаются в aria-describedby", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <TextField label="Почта" value="" onChangeText={noop} hint="До 254 символов" />,
      );

      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");
      const described = container.querySelector("input") as HTMLInputElement;
      expect(document.getElementById(described.getAttribute("aria-describedby") as string)?.textContent).toBe(
        "До 254 символов",
      );

      await render(
        <TextField label="Почта" value="" onChangeText={noop} error="Введите адрес" />,
      );

      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");
      const invalid = container.querySelector("input") as HTMLInputElement;
      expect(invalid.getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(invalid.getAttribute("aria-describedby") as string)?.textContent).toBe(
        "Введите адрес",
      );
    } finally {
      errors.mockRestore();
    }
  });
});

describe("PasswordField", () => {
  it("скрывает пароль, показывает его иконкой и снова скрывает", async () => {
    const { container, render } = mounted();
    await render(
      <PasswordField
        label="Пароль"
        value="secret"
        onChangeText={noop}
        showLabel="Показать пароль"
      />,
    );

    const input = () => container.querySelector("input") as HTMLInputElement;
    const toggle = () =>
      container.querySelector("[aria-label='Показать пароль']") as HTMLElement;

    expect(input().type).toBe("password");
    expect(input().value).toBe("secret");
    expect(toggle().getAttribute("role")).toBe("button");
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    // Слов «показать/скрыть» не видно: в кнопке только иконка.
    expect(toggle().textContent?.trim()).toBe("");
    expect(toggle().querySelector("circle")).not.toBeNull();
    expect(toggle().querySelector("line")).toBeNull();

    await act(async () => toggle().click());

    expect(input().type).toBe("text");
    expect(input().value).toBe("secret");
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    // Пароль виден — иконка зачёркнутого глаза.
    expect(toggle().querySelector("circle")).toBeNull();
    expect(toggle().querySelector("line")).not.toBeNull();

    await act(async () => toggle().click());

    expect(input().type).toBe("password");
    expect(input().value).toBe("secret");
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("не отправляет форму, не триггерит onSubmitEditing и не забирает фокус у поля", async () => {
    const onSubmit = vi.fn();
    const onSubmitEditing = vi.fn();
    const { container, render } = mounted();
    await render(
      <form onSubmit={onSubmit}>
        <PasswordField
          label="Пароль"
          value="secret"
          onChangeText={noop}
          showLabel="Показать пароль"
          input={{
            autoComplete: "current-password",
            textContentType: "password",
            onSubmitEditing,
          }}
        />
      </form>,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    const toggle = container.querySelector("[aria-label='Показать пароль']") as HTMLElement;
    input.focus();
    input.setSelectionRange(2, 2);

    let mouseDown: MouseEvent | undefined;
    await act(async () => {
      mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      toggle.dispatchEvent(mouseDown);
      toggle.click();
    });

    // Браузер не уводит фокус из поля: нажатие отменяет действие mousedown.
    expect(mouseDown?.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSubmitEditing).not.toHaveBeenCalled();
    expect(input.value).toBe("secret");
    expect(input.getAttribute("autocomplete")).toBe("current-password");
    expect(input.type).toBe("text");
  });

  it("на вебе отдаёт состояние aria-pressed и не протаскивает нативные пропсы в DOM", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <PasswordField
          label="Пароль"
          value="secret"
          onChangeText={noop}
          showLabel="Показать пароль"
        />,
      );

      const toggle = container.querySelector("[aria-label='Показать пароль']") as HTMLElement;
      const names = Array.from(toggle.attributes, (attribute) => attribute.name);
      // Только веб-семантика: role + aria-pressed, без accessibilityState/accessibilityRole.
      expect(toggle.getAttribute("role")).toBe("button");
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
      expect(names.filter((name) => name.startsWith("accessibility"))).toEqual([]);
      expect(names).not.toContain("accessibilitystate");
      expect(errors).not.toHaveBeenCalled();

      await act(async () => toggle.click());

      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it("не отдаёт нативный hint в DOM: подсказка пароля остаётся в aria-describedby", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <PasswordField
          label="Пароль"
          value="secret"
          onChangeText={noop}
          showLabel="Показать пароль"
          hint="От 8 символов"
        />,
      );

      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");
      const input = container.querySelector("input") as HTMLInputElement;
      expect(document.getElementById(input.getAttribute("aria-describedby") as string)?.textContent).toBe(
        "От 8 символов",
      );
    } finally {
      errors.mockRestore();
    }
  });

  it("переключается с клавиатуры и остаётся в порядке табуляции", async () => {
    const { container, render } = mounted();
    await render(
      <PasswordField
        label="Пароль"
        value="secret"
        onChangeText={noop}
        showLabel="Показать пароль"
      />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    const toggle = container.querySelector("[aria-label='Показать пароль']") as HTMLElement;
    expect(toggle.getAttribute("tabindex")).toBe("0");

    toggle.focus();
    await act(async () => {
      toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });
});
