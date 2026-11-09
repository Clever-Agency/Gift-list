import { afterEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  setAccessibilityFocus: vi.fn(),
  findNodeHandle: vi.fn(() => 42),
}));

vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: native.setAccessibilityFocus },
  findNodeHandle: native.findNodeHandle,
}));

const fieldScroll = vi.hoisted(() => ({
  scrollFieldIntoView: vi.fn<(node: object, onDone: () => void) => void>(),
}));

vi.mock("./field-scroll.native", () => fieldScroll);

import { focusField, restoreFocus } from "./focus.native";

afterEach(function clearMocks() {
  vi.clearAllMocks();
});

describe("focusField (native): сначала прокрутка, затем фокус", () => {
  it("поле не получает фокус, пока страница не прокрутилась", () => {
    const input = { focus: vi.fn() };

    focusField(input);

    expect(fieldScroll.scrollFieldIntoView).toHaveBeenCalledTimes(1);
    expect(fieldScroll.scrollFieldIntoView.mock.calls[0]?.[0]).toBe(input);
    expect(input.focus).not.toHaveBeenCalled();

    const continueToFocus = fieldScroll.scrollFieldIntoView.mock.calls[0]?.[1];
    continueToFocus?.();

    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it("радиогруппа без focus после прокрутки получает доступный фокус", () => {
    const group = {};

    focusField(group);
    const continueToFocus = fieldScroll.scrollFieldIntoView.mock.calls[0]?.[1];
    continueToFocus?.();

    expect(native.findNodeHandle).toHaveBeenCalledWith(group);
    expect(native.setAccessibilityFocus).toHaveBeenCalledWith(42);
  });

  it("пустой узел ничего не прокручивает", () => {
    focusField(null);
    focusField(undefined);

    expect(fieldScroll.scrollFieldIntoView).not.toHaveBeenCalled();
  });
});

describe("restoreFocus (native)", () => {
  it("возвращает доступный фокус, но не прокручивает страницу", () => {
    const node = {};

    restoreFocus(node);

    expect(fieldScroll.scrollFieldIntoView).not.toHaveBeenCalled();
    expect(native.findNodeHandle).toHaveBeenCalledWith(node);
    expect(native.setAccessibilityFocus).toHaveBeenCalledWith(42);
  });
});
