import { describe, expect, it, vi } from "vitest";
import { focusField, restoreFocus } from "./focus";

describe("focusField", () => {
  it("фокусирует поле и прокручивает его к центру без анимации", () => {
    const node = { focus: vi.fn(), scrollIntoView: vi.fn() };

    focusField(node);

    expect(node.focus).toHaveBeenCalledTimes(1);
    expect(node.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  });

  it("узел без scrollIntoView всё равно получает фокус", () => {
    const node = { focus: vi.fn() };

    focusField(node);

    expect(node.focus).toHaveBeenCalledTimes(1);
  });

  it("пустой узел не падает", () => {
    expect(function callWithNull() {
      focusField(null);
      focusField(undefined);
    }).not.toThrow();
  });
});

describe("restoreFocus", () => {
  it("возвращает фокус на элемент, не прокручивая страницу", () => {
    const node = { focus: vi.fn(), scrollIntoView: vi.fn() };

    restoreFocus(node);

    expect(node.focus).toHaveBeenCalledTimes(1);
    expect(node.scrollIntoView).not.toHaveBeenCalled();
  });
});
