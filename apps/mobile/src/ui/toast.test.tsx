// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOAST_FADE_MS,
  TOAST_MIN_MS,
  TOAST_MS_PER_CHAR,
  ToastHost,
  toastDurationMs,
} from "@/ui/toast";

const ACTION = "Отменить";

/** Состояние диктора: `AccessibilityInfo` отвечает им на подписку и на запрос. */
const narration = vi.hoisted(() => ({ enabled: false }));
const listeners = vi.hoisted(() => new Set<(enabled: boolean) => void>());

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as { toast: { close: string } };

  return {
    // `app.toast` → `toast` в каталоге, как и у настоящего IntlProvider.
    useTranslations: () => (key: string) => (key === "close" ? app.toast.close : key),
  };
});

vi.mock("react-native", () => {
  return {
    AccessibilityInfo: {
      isScreenReaderEnabled: () => Promise.resolve(narration.enabled),
      addEventListener: (event: string, listener: (enabled: boolean) => void) => {
        if (event !== "screenReaderChanged") return { remove: () => {} };
        listeners.add(listener);
        return {
          remove: () => {
            listeners.delete(listener);
          },
        };
      },
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HostProps = {
  message: string;
  tone?: "info" | "error";
  persistent?: boolean;
  action?: { label: string; onPress: () => void };
};

const onDismiss = vi.fn();
let host: Root;
let container: HTMLDivElement;
let mounted = false;

async function render(props: HostProps) {
  mounted = true;
  await act(async () => {
    host.render(<ToastHost onDismiss={onDismiss} {...props} />);
  });
  // `isScreenReaderEnabled` отвечает промисом — даём ему осесть до хода часов.
  await act(async () => {
    await Promise.resolve();
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function element(selector: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Не найден элемент ${selector}`);
  return found;
}

function button(label: string): HTMLElement {
  const found = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
    (node) => node.textContent === label,
  );
  if (!found) throw new Error(`Не найдена кнопка «${label}»`);
  return found;
}

/** A toast button by the name a screen reader announces. */
function buttonByName(name: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[role="button"][aria-label="${name}"]`);
}

/** Атомарный класс непрозрачности Tamagui: `_o-…` у корня тоста. */
function opacityClass(node: HTMLElement): string {
  return node.className
    .split(/\s+/)
    .filter((name) => name.startsWith("_o-"))
    .join(" ");
}

/** React слушает фокус через focusin/focusout — они всплывают. */
function focus(node: HTMLElement) {
  act(() => {
    node.dispatchEvent(new Event("focusin", { bubbles: true }));
  });
}

function blur(node: HTMLElement) {
  act(() => {
    node.dispatchEvent(new Event("focusout", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Часы нужны обеим частям паузы: таймеру и остатку времени (`Date.now`).
  vi.useFakeTimers({
    now: 0,
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  narration.enabled = false;
  listeners.clear();
  mounted = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  if (mounted) await act(async () => host.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("ToastHost: сам скрывается по таймеру", () => {
  it("короткий тост скрывается через 3 секунды, а на 2999 мс ещё виден", async () => {
    await render({ message: "Сохранено", tone: "info" });
    // Floor безопасного минимума: прежние 4 с минус ровно 1000 мс.
    expect(TOAST_MIN_MS).toBe(3000);
    expect(toastDurationMs("Сохранено")).toBe(3000);
    // Граница floor: 50 символов — ещё 3000, 51-й символ уже добавляет время.
    expect(toastDurationMs("x".repeat(50))).toBe(3000);
    expect(toastDurationMs("x".repeat(51))).toBe(3060);

    advance(2999);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("длинное сообщение живёт ровно на 1000 мс меньше прежнего: 60 мс на символ", async () => {
    const message = "Не получилось сохранить желание: сервер не отвечает, попробуйте позже";
    const previous = 1000 + 60 * message.length;
    const expected = toastDurationMs(message);
    // Прежняя формула max(4000, 1000 + 60 × символ) давала 5140 мс ⇒ стало 4140 мс.
    expect(previous).toBeGreaterThan(4000);
    expect(expected).toBe(previous - 1000);
    expect(expected).toBe(TOAST_MS_PER_CHAR * message.length);

    await render({ message, tone: "info" });
    advance(expected - 1);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("ошибка не скрывается сама: «Нет сети» ждёт «Закрыть»", async () => {
    await render({ message: "Нет сети", tone: "error" });
    expect(container.querySelector("div[role='alert']")).not.toBeNull();

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("persistent-тост не скрывается сам, даже если это не ошибка", async () => {
    await render({ message: "Сохранено", tone: "info", persistent: true });

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ошибка с persistent=false скрывается по таймеру", async () => {
    await render({ message: "Нет сети", tone: "error", persistent: false });

    advance(2999);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("тост с действием без диктора скрывается по таймеру", async () => {
    await render({
      message: "Добавлено в вишлист",
      tone: "info",
      action: { label: ACTION, onPress: vi.fn() },
    });

    advance(2999);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("новый текст перезапускает таймер со своей длительностью", async () => {
    await render({ message: "Сохранено", tone: "info" });
    // Короткий тост почти дожил до своего дедлайна, но его заменили.
    advance(TOAST_MIN_MS - 1);

    const longer = "Не получилось сохранить желание: сервер не отвечает, попробуйте позже";
    const expected = toastDurationMs(longer);
    expect(expected).toBeGreaterThan(TOAST_MIN_MS);
    await render({ message: longer, tone: "info" });

    // Отсчёт начался заново и идёт от длительности нового текста.
    advance(expected - 1);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("размонтирование гасит таймер", async () => {
    await render({ message: "Сохранено", tone: "info" });
    advance(1000);

    await act(async () => host.unmount());
    mounted = false;

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("fade начинается до дедлайна, а onDismiss приходит ровно в срок", async () => {
    await render({ message: "Сохранено", tone: "info" });
    const toast = element('[data-testid="toast-host"]');
    const shown = opacityClass(toast);
    expect(shown).not.toBe("");

    // Дефолт не сдвинут: дедлайн по-прежнему 3000 мс.
    advance(TOAST_MIN_MS - TOAST_FADE_MS - 1);
    expect(opacityClass(toast)).toBe(shown);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    // Fade уже идёт, но экран ещё не просили убрать тост.
    expect(opacityClass(toast)).not.toBe(shown);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(TOAST_FADE_MS);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("крестик даёт fade доиграть и только потом убирает тост", async () => {
    await render({ message: "Нет сети", tone: "error" });

    act(() => {
      button("Закрыть").click();
    });
    expect(onDismiss).not.toHaveBeenCalled();

    advance(TOAST_FADE_MS - 1);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ToastHost: действие и диктор", () => {
  it("при включённом дикторе тост с действием не скрывается сам", async () => {
    narration.enabled = true;
    await render({ message: "Добавлено в вишлист", tone: "info", action: { label: ACTION, onPress: vi.fn() } });

    const text = container.textContent ?? "";
    expect(text.indexOf(ACTION)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(ACTION)).toBeLessThan(text.indexOf("Закрыть"));

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("включение диктора на лету снимает таймер тоста с действием", async () => {
    await render({
      message: "Добавлено в вишлист",
      tone: "info",
      action: { label: ACTION, onPress: vi.fn() },
    });
    advance(1000);

    act(() => {
      for (const listener of listeners) listener(true);
    });

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("размонтирование отписывает от события диктора", async () => {
    await render({ message: "Сохранено", tone: "info", action: { label: ACTION, onPress: vi.fn() } });
    expect(listeners.size).toBe(1);

    await act(async () => host.unmount());
    mounted = false;

    expect(listeners.size).toBe(0);
  });

  it("фокус на кнопке останавливает отсчёт, а blur продолжает с остатка", async () => {
    await render({ message: "Сохранено", tone: "info" });
    advance(2000);

    const close = button("Закрыть");
    focus(close);
    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();

    blur(close);
    // Осталось 1 с из 3 с: сначала дедлайн не наступает, потом наступает.
    advance(999);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hover останавливает отсчёт и продолжает его с остатка", async () => {
    await render({ message: "Сохранено", tone: "info" });
    advance(1000);

    const toast = element('[role="status"]');
    act(() => {
      toast.dispatchEvent(new Event("pointerover", { bubbles: true }));
    });
    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      toast.dispatchEvent(new Event("pointerout", { bubbles: true }));
    });
    advance(1999);
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ToastHost: доступность", () => {
  it("info — вежливый status, error — срочный alert", async () => {
    await render({ message: "Сохранено", tone: "info" });

    const status = element('[role="status"]');
    expect(status.textContent).toContain("Сохранено");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await render({ message: "Нет сети", tone: "error" });

    const alert = element('[role="alert"]');
    expect(alert.textContent).toContain("Нет сети");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("хост остаётся на месте с testID toast-host", async () => {
    await render({ message: "Сохранено", tone: "info" });
    expect(container.querySelector('[data-testid="toast-host"]')).not.toBeNull();
    expect(container.textContent).toContain("Сохранено");
  });

  it("у кнопок тоста есть доступные имена: «Закрыть» и действие", async () => {
    await render({
      message: "Добавлено в вишлист",
      tone: "info",
      action: { label: ACTION, onPress: vi.fn() },
    });

    // `role="button"` + `aria-label`: the name a screen reader announces.
    expect(buttonByName("Закрыть")).not.toBeNull();
    expect(buttonByName(ACTION)).not.toBeNull();
  });

  it("без действия у тоста одна кнопка — «Закрыть»", async () => {
    await render({ message: "Сохранено", tone: "info" });

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(1);
    expect(buttonByName("Закрыть")).not.toBeNull();
  });
});
