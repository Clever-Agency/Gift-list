import { beforeEach, describe, expect, it, vi } from "vitest";
import { pressLink, shouldNavigateInApp, type LinkPressEvent } from "./link-press";

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("expo-router", () => ({ router: navigation }));

/**
 * The click rule of the side menu (Story 6.2, review F1): a plain left click on
 * a web link is handled inside the app, everything else keeps the browser
 * default — «открыть в новой вкладке», «в новом окне», the context menu.
 */
function click(overrides: Partial<LinkPressEvent> = {}): LinkPressEvent {
  return {
    button: 0,
    preventDefault: vi.fn(),
    currentTarget: { target: "" },
    ...overrides,
  };
}

beforeEach(() => {
  navigation.navigate.mockClear();
});

describe("shouldNavigateInApp", () => {
  it("обычный левый клик — в приложении", () => {
    expect(shouldNavigateInApp(click())).toBe(true);
    expect(shouldNavigateInApp(click({ currentTarget: null }))).toBe(true);
    expect(shouldNavigateInApp(click({ currentTarget: { target: "self" } }))).toBe(true);
    expect(shouldNavigateInApp(click({ button: undefined }))).toBe(true);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
  ] as const)("клик с %s — браузеру", (_name, modifiers) => {
    expect(shouldNavigateInApp(click(modifiers))).toBe(false);
  });

  it("средняя и правая кнопки — браузеру", () => {
    expect(shouldNavigateInApp(click({ button: 1 }))).toBe(false);
    expect(shouldNavigateInApp(click({ button: 2 }))).toBe(false);
  });

  it("target=_blank и уже отменённый клик — браузеру", () => {
    expect(shouldNavigateInApp(click({ currentTarget: { target: "_blank" } }))).toBe(false);
    expect(shouldNavigateInApp(click({ defaultPrevented: true }))).toBe(false);
  });

  it("без события не падает", () => {
    expect(shouldNavigateInApp()).toBe(false);
    expect(shouldNavigateInApp(null)).toBe(false);
  });
});

describe("pressLink", () => {
  it("обычный клик — preventDefault и переход через роутер", () => {
    const event = click();

    pressLink("/reservations")(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("/reservations");
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["средней кнопкой", { button: 1 }],
    ["с target=_blank", { currentTarget: { target: "_blank" } }],
  ] as const)("клик %s не перехватывается", (_name, overrides) => {
    const event = click(overrides);

    pressLink("/friends")(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("без события ничего не делает", () => {
    pressLink("/")(undefined);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
