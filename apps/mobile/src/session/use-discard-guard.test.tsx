// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiscardGuard } from "@/session/use-discard-guard";

const navigation = vi.hoisted(() => ({ dispatch: vi.fn() }));
const platform = vi.hoisted(() => ({ os: "android" as "android" | "web" }));

// The guard asks the platform before it touches the browser's history; the
// tests here keep the native behaviour unless a test says otherwise.
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
  },
}));

type Action = { type: string };
type BlockedEvent = { data: { action: Action }; repeat: () => void };

/**
 * `usePreventRemove` as the vendored hook behaves: the navigator keeps the
 * `enabled` and the callback of the LAST COMMITTED render, so a state update in
 * the same tick is too late and a blocked removal stays blocked until that value
 * changes. Only the callback's `repeat` turns prevention off at once and replays
 * the action the navigator asked for.
 */
const prevent = vi.hoisted(() => {
  let enabled = false;
  let callback: ((event: BlockedEvent) => void) | undefined;

  return {
    use(nextEnabled: boolean, nextCallback?: (event: BlockedEvent) => void) {
      enabled = nextEnabled;
      callback = nextCallback;
    },
    enabled: () => enabled,
    /** A removal the navigator tries to run right now: system back, `back()`, … */
    attemptRemove(action: Action) {
      if (!enabled) {
        navigation.dispatch(action);
        return;
      }
      callback?.({
        data: { action },
        repeat: () => {
          // The real hook turns prevention off synchronously, then dispatches.
          enabled = false;
          navigation.dispatch(action);
        },
      });
    },
    reset() {
      enabled = false;
      callback = undefined;
    },
  };
});

vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (enabled: boolean, callback?: (event: BlockedEvent) => void) =>
    prevent.use(enabled, callback),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Guard = {
  proceed(): boolean;
  cancel(): void;
  allowNextLeave(): void;
  revokeLeave(): void;
};

let holderRef: { current: Guard | null };
let blocked: () => void;

/** The smallest screen the guard needs: it hands the returned guard to the test. */
function Screen({
  enabled,
  onBlocked,
  apiRef,
}: {
  enabled: boolean;
  onBlocked: () => void;
  apiRef: { current: Guard | null };
}) {
  const guard = useDiscardGuard(enabled, onBlocked);
  useEffect(() => {
    apiRef.current = guard;
  }, [apiRef, guard]);
  return null;
}

let root: Root;
let container: HTMLElement;

async function render(enabled: boolean) {
  await act(async () => {
    root.render(<Screen enabled={enabled} onBlocked={blocked} apiRef={holderRef} />);
  });
}

/** The hook's return value from the latest committed render. */
function guard(): Guard {
  expect(holderRef.current, "хук отдал proceed/cancel").not.toBeNull();
  return holderRef.current as Guard;
}

const goBack = { type: "GO_BACK" };

beforeEach(() => {
  vi.resetAllMocks();
  platform.os = "android";
  prevent.reset();
  holderRef = { current: null };
  blocked = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useDiscardGuard", () => {
  it("передаёт в навигатор текущее состояние защиты", async () => {
    await render(false);
    expect(prevent.enabled()).toBe(false);

    await render(true);
    expect(prevent.enabled()).toBe(true);
  });

  it("заблокированный переход отдаёт экрану: экран вызван, переход не выполнен", async () => {
    await render(true);

    await act(async () => prevent.attemptRemove(goBack));

    expect(blocked).toHaveBeenCalledTimes(1);
    // The action is only held, not run: the screen decides what happens next.
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("без обхода каждый следующий переход всё ещё блокируется", async () => {
    await render(true);

    await act(async () => prevent.attemptRemove(goBack));
    await act(async () => prevent.attemptRemove({ type: "POP_TO" }));

    expect(blocked).toHaveBeenCalledTimes(2);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("обход пропускает переход сразу, в том же такте, и не спрашивает экран", async () => {
    await render(true);

    await act(async () => {
      // The navigator still holds `enabled: true` from the last committed render.
      expect(prevent.enabled()).toBe(true);
      guard().allowNextLeave();
      prevent.attemptRemove(goBack);
    });

    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith(goBack);
    expect(blocked).not.toHaveBeenCalled();
  });

  it("revokeLeave снимает обход: переход снова спрашивает экран", async () => {
    await render(true);

    await act(async () => {
      guard().allowNextLeave();
      // The way out never happened (a failed sign-out): the form must be guarded.
      guard().revokeLeave();
      expect(prevent.enabled()).toBe(true);
    });
    await act(async () => prevent.attemptRemove(goBack));

    expect(blocked).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("proceed повторяет ровно сохранённый переход и отвечает true", async () => {
    await render(true);
    await act(async () => prevent.attemptRemove(goBack));

    let repeated = false;
    await act(async () => {
      repeated = guard().proceed();
    });

    expect(repeated).toBe(true);
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith(goBack);
    // Repeating the way out is not a second question.
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it("proceed без сохранённого перехода ничего не делает и отвечает false", async () => {
    await render(true);

    let repeated = true;
    await act(async () => {
      repeated = guard().proceed();
    });

    expect(repeated).toBe(false);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("cancel забывает переход: следующий proceed ничего не повторяет", async () => {
    await render(true);
    await act(async () => prevent.attemptRemove(goBack));

    await act(async () => guard().cancel());

    let repeated = true;
    await act(async () => {
      repeated = guard().proceed();
    });

    expect(repeated).toBe(false);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });
});

/**
 * On web the navigator never sees the browser's Back (the URL changes first), so
 * the guard asks the screen itself and `proceed()` replays that Back instead of a
 * navigator action.
 */
describe("useDiscardGuard: браузерная кнопка «назад»", () => {
  it("веб: «назад» спрашивает экран, а proceed уводит на предыдущую страницу", async () => {
    platform.os = "web";
    window.history.replaceState({ id: "list" }, "", "/");
    window.history.pushState({ id: "form" }, "", "/gifts/new");
    await render(true);

    await act(async () => window.history.back());

    expect(blocked).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/gifts/new");
    // The navigator asked for nothing: the block is the browser's.
    expect(navigation.dispatch).not.toHaveBeenCalled();

    let repeated = false;
    await act(async () => {
      repeated = guard().proceed();
    });

    expect(repeated).toBe(true);
    expect(window.location.pathname).toBe("/");
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("нативная платформа: историю браузера не трогает", async () => {
    window.history.replaceState({ id: "list" }, "", "/");
    window.history.pushState({ id: "form" }, "", "/gifts/new");
    const length = window.history.length;

    await render(true);

    expect(window.history.length).toBe(length);
    expect(window.history.state).toMatchObject({ id: "form" });
  });
});
