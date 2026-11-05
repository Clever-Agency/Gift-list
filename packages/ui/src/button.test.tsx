// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("Button", () => {
  it("на вебе это настоящий <button> с подписью как именем", async () => {
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={vi.fn()} />);

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toBe("Сохранить");
    expect(button?.textContent).toBe("Сохранить");
    expect(button?.getAttribute("type")).toBe("button");
  });

  it("нажатие вызывает onPress", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={onPress} />);

    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disabled не нажимается и сообщается как отключённая", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={onPress} disabled />);

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("focusableWhenDisabled оставляет кнопку в порядке фокуса, но без нажатия", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <Button label="Отмена" variant="ghost" onPress={onPress} disabled focusableWhenDisabled />,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.tabIndex).toBe(0);
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("busy: не берёт второе нажатие и сообщается занятой", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохраняем…" onPress={onPress} busy />);

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("у каждого варианта есть кнопка с подписью", async () => {
    const { container, render } = mounted();
    for (const variant of ["primary", "reserve", "secondary", "ghost", "destructive"] as const) {
      await render(<Button label={variant} variant={variant} onPress={vi.fn()} />);
      expect(container.querySelector("button")?.textContent).toBe(variant);
    }
  });

  it("busy остаётся фокусируемой: фокус не уходит на body, нажатие и submit игнорируются", async () => {
    const onPress = vi.fn();
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const { container, render } = mounted();
    await render(
      <form onSubmit={onSubmit as never}>
        <Button label="Сохранить" type="submit" onPress={onPress} />
      </form>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);

    await render(
      <form onSubmit={onSubmit as never}>
        <Button label="Сохранить" type="submit" onPress={onPress} busy />
      </form>,
    );
    const busy = container.querySelector("button") as HTMLButtonElement;
    expect(busy.disabled).toBe(false);
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.tabIndex).toBe(0);
    expect(document.activeElement).toBe(busy);

    await act(async () => {
      busy.click();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
