import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeForeground } from "./foreground.native";

const appState = vi.hoisted(() => {
  const handlers = new Set<(state: string) => void>();
  return {
    handlers,
    currentState: "active",
    addEventListener: vi.fn(function addEventListener(
      _type: string,
      handler: (state: string) => void,
    ) {
      handlers.add(handler);
      return { remove: () => handlers.delete(handler) };
    }),
  };
});

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appState.currentState;
    },
    addEventListener: appState.addEventListener,
  },
}));

function change(state: string) {
  appState.handlers.forEach(function notify(handler) {
    handler(state);
  });
}

beforeEach(() => {
  appState.handlers.clear();
  appState.addEventListener.mockClear();
  appState.currentState = "active";
});

describe("subscribeForeground", () => {
  it("не срабатывает на повторный active", () => {
    const onActive = vi.fn();
    subscribeForeground(onActive);

    change("active");

    expect(onActive).not.toHaveBeenCalled();
  });

  it("срабатывает один раз на возврат из фона", () => {
    const onActive = vi.fn();
    subscribeForeground(onActive);

    change("background");
    change("active");
    expect(onActive).toHaveBeenCalledTimes(1);

    change("inactive");
    change("active");
    expect(onActive).toHaveBeenCalledTimes(2);
  });

  it("считает возвратом переход из неактивного состояния", () => {
    const onActive = vi.fn();
    subscribeForeground(onActive);

    change("inactive");
    change("active");

    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it("подписка, сделанная в фоне, ждёт первого active", () => {
    appState.currentState = "background";
    const onActive = vi.fn();
    subscribeForeground(onActive);

    change("active");

    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it("отписка снимает обработчик", () => {
    const onActive = vi.fn();
    const unsubscribe = subscribeForeground(onActive);

    unsubscribe();
    change("background");
    change("active");

    expect(onActive).not.toHaveBeenCalled();
  });
});
