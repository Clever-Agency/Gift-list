// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, escape, settle } from "@/test/dom";
import { restoreFocus } from "@/ui/focus";
import { WishDetailDialog } from "@/ui/wish-detail-dialog";
import type { DetailLoadResult } from "@/ui/wish-detail-load";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

  function format(template: string, values?: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, function insert(_match, name: string) {
      return String(values?.[name] ?? "");
    });
  }

  return {
    useLocale: function useLocale() {
      return "ru";
    },
    useTranslations: function useTranslations(namespace: string) {
      return function translate(key: string, values?: Record<string, unknown>) {
        const node = dig(messages, namespace ? `${namespace}.${key}` : key);
        return typeof node === "string" ? format(node, values) : key;
      };
    },
  };
});

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Плед",
    description: "Тёплый плед, цвет овсяный.",
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: "https://shop.example/pled",
    visibility: "SECRET",
    quantity: "SINGLE",
    expiresOn: "2026-12-31",
    archivedAt: null,
    tags: [{ catalogId: "home", label: "Дом" }],
    status: "RESERVED",
    reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
    reservationLabel: "BOUGHT",
    ownerAction: "CONFIRM_GIVEN",
    reservation: {
      dueAt: "2026-12-01",
      phase: "ACTIVE",
      bought: true,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    },
    ...overrides,
  };
}

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
  await settle();
}

function body(): string {
  return dialogElement()?.textContent ?? "";
}

describe("WishDetailDialog", () => {
  it("гость видит разрешённые поля и не видит видимость", async () => {
    await render(
      <WishDetailDialog open viewer="guest" snapshot={gift()} onClose={function noop() {}} />,
    );

    const dialog = dialogElement();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(body()).toContain("Плед");
    expect(body()).toContain("Тёплый плед, цвет овсяный.");
    expect(body()).toContain("https://shop.example/pled");
    expect(body()).toContain("31.12.2026");
    expect(body()).toContain("Дом");
    expect(body()).toContain("Берёт Анна");
    expect(body()).toContain("Куплен");
    expect(body()).toContain("Куплено");
    expect(body()).toContain("01.12.2026");
    expect(body()).not.toContain("Секрет");
    expect(body()).not.toContain("Кто видит");
    expect(body()).not.toContain("Ждёт вашего подтверждения");
  });

  it("владелец не видит срок, «Купил» и подпись брони, даже если они есть в объекте", async () => {
    await render(
      <WishDetailDialog
        open
        viewer="owner"
        snapshot={gift()}
        onClose={function noop() {}}
        onEdit={function noop() {}}
      />,
    );

    expect(body()).toContain("Кто видит");
    expect(body()).toContain("Секрет");
    expect(body()).toContain("Ждёт вашего подтверждения");
    expect(body()).toContain("Изменить желание");
    expect(body()).not.toContain("01.12.2026");
    expect(body()).not.toContain("Куплено");
    expect(body()).not.toContain("Куплен");
    expect(body()).not.toContain("Показать владельцу");
  });

  it("недоступное желание не показывает поля снимка", async () => {
    function missing(): Promise<DetailLoadResult> {
      return Promise.resolve({ ok: false, reason: "not_found" });
    }
    await render(
      <WishDetailDialog open viewer="guest" snapshot={gift()} load={missing} onClose={function noop() {}} />,
    );

    expect(body()).toContain("Желание не найдено.");
    expect(body()).not.toContain("Тёплый плед");
    expect(body()).not.toContain("https://shop.example/pled");
    expect(body()).not.toContain("Секрет");
    const name = document.getElementById(
      dialogElement()?.getAttribute("aria-labelledby") ?? "",
    );
    expect(name?.textContent).toBe("Плед");
  });

  it("ошибка сети — дословный текст и повтор, без полей", async () => {
    const load = vi.fn(function fail(): Promise<DetailLoadResult> {
      return Promise.resolve({ ok: false, reason: "network" });
    });
    await render(
      <WishDetailDialog open viewer="owner" snapshot={gift()} load={load} onClose={function noop() {}} />,
    );

    expect(body()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(body()).not.toContain("Тёплый плед");
    await click(Array.from(document.querySelectorAll("button")).find(function isRetry(node) {
      return node.textContent?.includes("Повторить");
    }));
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("закрытие крестиком и Escape возвращает фокус на карточку", async () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      const opener = useRef<HTMLButtonElement | null>(null);

      function openDialog() {
        setOpen(true);
      }
      function closeDialog() {
        setOpen(false);
      }
      function closed() {
        restoreFocus(opener.current);
      }

      return (
        <>
          <button ref={opener} type="button" onClick={openDialog}>
            Плед
          </button>
          <WishDetailDialog
            open={open}
            viewer="guest"
            snapshot={gift({ reservation: undefined, reservationLabel: null })}
            onClose={closeDialog}
            onClosed={closed}
          />
        </>
      );
    }
    Screen.displayName = "Screen";

    await render(<Screen />);
    const opener = container.querySelector("button") as HTMLButtonElement;
    opener.focus();
    await click(opener);
    await settle();
    expect(dialogElement()).not.toBeNull();
    expect(document.activeElement).not.toBe(opener);

    const close = document.querySelector("[aria-label='Закрыть']") as HTMLElement;
    expect(close).not.toBeNull();
    await click(close);
    await settle(300);
    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(opener);

    await click(opener);
    await settle();
    await act(async () => {
      escape();
    });
    await settle(300);
    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
