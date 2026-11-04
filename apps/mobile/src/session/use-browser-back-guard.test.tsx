// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserBackGuard, type BrowserBackGuard } from "@/session/use-browser-back-guard";

const platform = vi.hoisted(() => ({ os: "web" as "web" | "android" | "ios" }));

// The hook asks the platform first: Android and iOS must never touch the window.
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let holderRef: { current: BrowserBackGuard | null };
let blocked: () => void;

/** The smallest screen the guard needs: it hands the returned guard to the test. */
function Screen({
  enabled,
  onBlocked,
  apiRef,
}: {
  enabled: boolean;
  onBlocked: () => void;
  apiRef: { current: BrowserBackGuard | null };
}) {
  const guard = useBrowserBackGuard(enabled, onBlocked);
  useEffect(() => {
    apiRef.current = guard;
  }, [apiRef, guard]);
  return null;
}

let root: Root;
let container: HTMLElement;
/** The root is still mounted: `afterEach` must not unmount it twice. */
let live = true;
/** `history.length` of the seeded pages: the list, then the form on top of it. */
let seeded = 0;

async function render(enabled: boolean) {
  await act(async () => {
    root.render(<Screen enabled={enabled} onBlocked={blocked} apiRef={holderRef} />);
  });
}

async function unmount() {
  live = false;
  await act(async () => root.unmount());
}

/** The guard's return value from the latest committed render. */
function guard(): BrowserBackGuard {
  expect(holderRef.current, "хук отдал proceed/cancel").not.toBeNull();
  return holderRef.current as BrowserBackGuard;
}

/** A real Back: the browser selects the previous entry and fires `popstate`. */
async function browserBack() {
  await act(async () => {
    window.history.back();
  });
}

/** A reload or a closed tab, as the browser announces it before leaving the page. */
function beforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  platform.os = "web";
  live = true;
  holderRef = { current: null };
  blocked = vi.fn();
  // The pages the user came through: the list, then the form.
  window.history.replaceState({ id: "seed" }, "", "/seed");
  window.history.pushState({ id: "list" }, "", "/");
  window.history.pushState({ id: "form" }, "", "/gifts/new");
  seeded = window.history.length;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  if (live) await unmount();
  container.remove();
});

describe("useBrowserBackGuard: браузерная кнопка «назад»", () => {
  it("грязная форма: «назад» остаётся на форме, адрес прежний, экран спрошен", async () => {
    await render(true);
    // The guard keeps one entry of its own on top of the form, repeating it.
    expect(window.history.length).toBe(seeded + 1);
    expect(window.history.state).toMatchObject({ id: "form", giftFormGuard: true });

    await browserBack();

    expect(blocked).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/gifts/new");
    // No empty Back for the user: the copy is put back, the count does not grow.
    expect(window.history.length).toBe(seeded + 1);
    expect(window.history.state).toMatchObject({ giftFormGuard: true });
  });

  it("«Не сохранять» уводит на предыдущую страницу и больше не спрашивает", async () => {
    await render(true);
    await browserBack();

    let repeated = false;
    await act(async () => {
      repeated = guard().proceed();
    });

    expect(repeated).toBe(true);
    expect(window.location.pathname).toBe("/");
    expect(window.history.state).toMatchObject({ id: "list" });
    // Replaying the way out is not a second question.
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it("крестик оставляет форму с черновиком, второй «назад» снова спрашивает", async () => {
    await render(true);
    await browserBack();
    expect(blocked).toHaveBeenCalledTimes(1);

    await act(async () => guard().cancel());

    let repeated = true;
    await act(async () => {
      repeated = guard().proceed();
    });
    expect(repeated, "после отмены повторять нечего").toBe(false);
    expect(window.location.pathname).toBe("/gifts/new");

    await browserBack();

    expect(blocked).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/gifts/new");
    expect(window.history.length).toBe(seeded + 1);
  });

  it("«Не сохранять»: переход начинается уже без вопроса браузера", async () => {
    await render(true);
    await browserBack();

    // The order matters: the native question is gone before the history moves.
    const preventedAtGo: boolean[] = [];
    const go = window.history.go.bind(window.history);
    const spy = vi.spyOn(window.history, "go").mockImplementation((delta?: number) => {
      preventedAtGo.push(beforeUnload().defaultPrevented);
      go(delta);
    });

    try {
      await act(async () => {
        guard().proceed();
      });
    } finally {
      spy.mockRestore();
    }

    expect(preventedAtGo).toEqual([false]);
    expect(window.location.pathname).toBe("/");
    // The listener stays gone: the answer has already been given.
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("свой выход экрана снимает вопрос браузера о перезагрузке", async () => {
    await render(true);
    expect(beforeUnload().defaultPrevented).toBe(true);

    await act(async () => guard().allowLeave());

    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("неудавшийся выход снова ставит вопрос браузера", async () => {
    await render(true);
    await act(async () => guard().allowLeave());
    expect(beforeUnload().defaultPrevented).toBe(false);

    await act(async () => guard().revokeLeave());

    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it("крестик оставляет вопрос браузера о перезагрузке", async () => {
    await render(true);
    await browserBack();

    await act(async () => guard().cancel());

    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it("чистая форма: лишней записи нет, «назад» уходит на список без вопроса", async () => {
    await render(false);
    expect(window.history.length).toBe(seeded);
    expect(window.history.state).toMatchObject({ id: "form" });

    await browserBack();

    expect(blocked).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });

  it("перезагрузка и закрытие вкладки спрашивают браузер только пока форма грязная", async () => {
    await render(true);
    expect(beforeUnload().defaultPrevented).toBe(true);

    await render(false);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("форма стала чистой: лишняя запись снята, обычный «назад» ведёт на список", async () => {
    await render(true);
    await render(false);

    // The copy is dropped at once, so the form's own entry is on top again.
    expect(window.history.state).toMatchObject({ id: "form" });
    expect(window.history.state).not.toHaveProperty("giftFormGuard");
    expect(blocked).not.toHaveBeenCalled();

    await browserBack();

    expect(blocked).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });

  it("свой выход экрана не принимается за вопрос и съедает лишнюю запись", async () => {
    await render(true);

    await act(async () => guard().allowLeave());
    // The router's own `go(-1)` for a save or «Не сохранять».
    await browserBack();

    expect(blocked).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/gifts/new");
    expect(window.history.state).not.toHaveProperty("giftFormGuard");
  });

  it("размонтирование снимает слушатели: поздний popstate никого не спрашивает", async () => {
    await render(true);
    await unmount();

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(blocked).not.toHaveBeenCalled();
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("Android и iOS: окно и историю не трогает", async () => {
    platform.os = "android";
    await render(true);

    expect(window.history.length).toBe(seeded);
    expect(window.history.state).toMatchObject({ id: "form" });
    expect(beforeUnload().defaultPrevented).toBe(false);

    await browserBack();

    expect(blocked).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });
});
