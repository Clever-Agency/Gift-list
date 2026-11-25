// @vitest-environment happy-dom
import { colors } from "@gift-list/ui";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click } from "@/test/dom";
import { OwnerActionLabel } from "@/ui/owner-action-label";

vi.mock("use-intl", async () => {
  const { getMessages } = await import("@gift-list/contracts");
  const messages = getMessages("ru");

  function dig(root: unknown, path: string): unknown {
    let node = root;
    for (const part of path.split(".")) {
      if (typeof node !== "object" || node === null || !(part in node)) return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return node;
  }

  return {
    useLocale: function useLocale() {
      return "ru";
    },
    useTranslations: function useTranslations(namespace: string) {
      return function translate(key: string) {
        const node = dig(messages, `${namespace}.${key}`);
        return typeof node === "string" ? node : key;
      };
    },
  };
});

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render(node: ReactNode) {
  await act(async () => {
    host.render(node);
  });
}

function strip(): HTMLElement {
  const node = container.querySelector<HTMLElement>("[data-testid='owner-action-label']");
  expect(node, "полоса OwnerActionLabel").not.toBeNull();
  return node as HTMLElement;
}

function received(): HTMLElement {
  return container.querySelector<HTMLElement>("[data-testid='owner-action-received']") as HTMLElement;
}

function keep(): HTMLElement {
  return container.querySelector<HTMLElement>("[data-testid='owner-action-keep']") as HTMLElement;
}

/**
 * Story 5.6 (`DESIGN.md` → OwnerActionLabel, `EXPERIENCE.md` → «Подписи брони»):
 * the owner's answer to an expired reservation. Two secondary buttons of their own,
 * the phase label above them, and a busy state that blocks both answers.
 */
describe("OwnerActionLabel", () => {
  it("рисует подпись фазы и два ответа «Получил» / «Не получал, оставить бронь»", async () => {
    const onReceived = vi.fn();
    const onKeep = vi.fn();
    await render(
      <OwnerActionLabel
        action="EXPIRED_NO_REPLY"
        onReceived={onReceived}
        onKeep={onKeep}
      />,
    );

    expect(strip().textContent).toContain("Срок брони истёк");
    expect(received().textContent).toContain("Получил");
    expect(keep().textContent).toContain("Не получал, оставить бронь");
    // Exactly the two answers: the third action («Снять бронь») lives in ⋮.
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(received().tagName).toBe("BUTTON");
    expect(keep().tagName).toBe("BUTTON");
  });

  it("каждый ответ зовёт свой обработчик и не трогает другой", async () => {
    const onReceived = vi.fn();
    const onKeep = vi.fn();
    await render(
      <OwnerActionLabel action="EXPIRED_NO_REPLY" onReceived={onReceived} onKeep={onKeep} />,
    );

    await click(received());
    expect(onReceived).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();

    await click(keep());
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onReceived).toHaveBeenCalledTimes(1);
  });

  /** `EXPERIENCE.md` → «Несколько действий»: busy blocks every answer of the strip. */
  it("busy: обе кнопки заняты, повторные нажатия глушатся", async () => {
    const onReceived = vi.fn();
    const onKeep = vi.fn();
    await render(
      <OwnerActionLabel
        action="EXPIRED_NO_REPLY"
        busy
        onReceived={onReceived}
        onKeep={onKeep}
      />,
    );

    for (const button of [received(), keep()]) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-busy")).toBe("true");
    }

    await click(received());
    await click(keep());
    expect(onReceived).not.toHaveBeenCalled();
    expect(onKeep).not.toHaveBeenCalled();
  });

  /** 360 px and the long Cyrillic copy: the strip stays one block, buttons wrap as a row. */
  it("на 360 px полоса с левым accent-краем и рядом кнопок, без вложенных нажатий", async () => {
    await render(
      <OwnerActionLabel action="EXPIRED_NO_REPLY" onReceived={vi.fn()} onKeep={vi.fn()} />,
    );

    const node = strip();
    expect(getComputedStyle(node).backgroundColor).toBe(colors.muted);
    expect(getComputedStyle(node).borderLeftWidth).toBe("3px");
    expect(getComputedStyle(node).borderLeftColor).toBe(colors["accent-foreground"]);
    // The answers are siblings inside the strip, never nested in one another.
    expect(keep().contains(received())).toBe(false);
    expect(received().parentElement).toBe(keep().parentElement);
    // The long copy is fully present, not cut with an ellipsis.
    expect(keep().textContent).toBe("Не получал, оставить бронь");
  });
});
