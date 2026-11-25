// @vitest-environment happy-dom
import { getMessages, type GiftCard } from "@gift-list/contracts";
import { act, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, escape, settle } from "@/test/dom";
import { restoreFocus } from "@/ui/focus";
import { WishDetailDialog, type WishDetailStep } from "@/ui/wish-detail-dialog";
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

function control(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (node) => (node.textContent ?? "").includes(label),
  );
}

/**
 * D-49 (CLE-124): the owner has no reservation actions. Even a stale snapshot with
 * `status: "RESERVED"`, the holder name and `ownerAction` gives no release button
 * and no phase label — only the ordinary actions of the wish.
 */
describe("WishDetailDialog: у владельца нет действий брони (D-49)", () => {
  it("старый ответ с бронью: «Снять бронь» нет, «Отметить полученным» есть", async () => {
    const onMarkReceived = vi.fn();
    await render(
      <WishDetailDialog
        open
        viewer="owner"
        snapshot={gift()}
        onClose={function noop() {}}
        onEdit={function noop() {}}
        onMarkReceived={onMarkReceived}
      />,
    );

    expect(control(getMessages("ru").app.gift.release.confirm)).toBeUndefined();
    expect(body()).not.toContain("Ждёт вашего подтверждения");
    expect(body()).not.toContain("Срок брони истёк");
    expect(control("Отметить полученным")).toBeDefined();

    await click(control("Отметить полученным"));
    expect(onMarkReceived).toHaveBeenCalledTimes(1);
  });
});

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
    expect(body()).toContain("Изменить желание");
    // D-49: a stale owner payload still reads as an open wish.
    expect(body()).toContain("Открыт");
    expect(body()).not.toContain("Забронирован");
    expect(body()).not.toContain("Берёт Анна");
    expect(body()).not.toContain("Ждёт вашего подтверждения");
    expect(body()).not.toContain("Срок брони истёк");
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

  it("владелец у забронированного не видит «Снять бронь» и полосы брони", async () => {
    const onRelease = vi.fn();
    await render(
      <WishDetailDialog
        open
        viewer="owner"
        snapshot={gift()}
        onClose={function noop() {}}
        onEdit={function noop() {}}
        onMarkReceived={vi.fn()}
      />,
    );

    expect(control("Изменить желание")).toBeDefined();
    expect(control(getMessages("ru").app.gift.release.confirm)).toBeUndefined();
    expect(body()).not.toContain("Ждёт вашего подтверждения");
    expect(body()).not.toContain("Берёт Анна");
    expect(onRelease).not.toHaveBeenCalled();
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

  /**
   * Story 5.3: владелец закрытого желания. «Изменить желание» нет — закрытое
   * желание только для просмотра; «Вернуть в открытые · ещё N мин» живёт ровно
   * столько, сколько окно сервера (`undoUntil`), и открывает ту же строку минут.
   */
  describe("Story 5.3: закрытое желание у владельца", () => {
    const inWindow = {
      status: "CLOSED" as const,
      undoUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
    };

    it("в окне отмены: нет «Изменить желание», есть возврат с остатком минут", async () => {
      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift(inWindow)}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onUndoClose={function noop() {}}
        />,
      );

      expect(control("Изменить желание")).toBeUndefined();
      expect(control("Вернуть в открытые · ещё 5 мин")).toBeDefined();
    });

    it("нажатие возврата зовёт onUndoClose, второго подтверждения нет", async () => {
      const onUndoClose = vi.fn();
      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift(inWindow)}
          onClose={function noop() {}}
          onUndoClose={onUndoClose}
        />,
      );

      await click(control("Вернуть в открытые · ещё 5 мин"));
      expect(onUndoClose).toHaveBeenCalledTimes(1);
    });

    it("окно вышло: у закрытого желания действий нет", async () => {
      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift({
            status: "CLOSED",
            undoUntil: new Date(Date.now() - 60_000).toISOString(),
          })}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onUndoClose={function noop() {}}
        />,
      );

      expect(control("Изменить желание")).toBeUndefined();
      expect(control("Вернуть в открытые · ещё 5 мин")).toBeUndefined();
      expect(control("Отметить полученным")).toBeUndefined();
    });

    it("открытое и забронированное: «Отметить полученным» есть, у закрытого — нет", async () => {
      const onMarkReceived = vi.fn();
      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift({
            status: "OPEN",
            reservedBy: null,
            reservationLabel: null,
            ownerAction: null,
            reservation: undefined,
          })}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onMarkReceived={onMarkReceived}
        />,
      );

      await click(control("Отметить полученным"));
      expect(onMarkReceived).toHaveBeenCalledTimes(1);

      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift()}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onMarkReceived={onMarkReceived}
        />,
      );
      expect(control("Отметить полученным")).toBeDefined();
      // D-49: the same action for a legacy reserved snapshot, no release button.
      expect(control(getMessages("ru").app.gift.release.confirm)).toBeUndefined();
    });
  });

  /**
   * Story 5.3: шаг закрытия — тот же механизм шагов. После «Отмены» фокус
   * возвращается на «Отметить полученным».
   */
  describe("Story 5.3: шаг «Подарок получен?»", () => {
    function OwnerCloseHarness() {
      const [step, setStep] = useState<WishDetailStep | null>(null);

      function openStep() {
        setStep({
          key: "close",
          title: "Подарок «Плед» получен?",
          cancelLabel: "Отмена",
          confirmLabel: "Подтвердить",
          onConfirm: function confirm() {},
          onCancel: function cancel() {
            setStep(null);
          },
        });
      }

      return (
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift()}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onMarkReceived={openStep}
          step={step}
        />
      );
    }
    OwnerCloseHarness.displayName = "OwnerCloseHarness";

    it("вопрос без брони, некрасная кнопка и фокус на «Отмене»", async () => {
      await render(<OwnerCloseHarness />);

      await click(control("Отметить полученным"));
      await settle();

      expect(body()).toContain("Подарок «Плед» получен?");
      expect(body()).not.toContain("Бронь");
      expect(control("Подтвердить")).toBeDefined();
      expect(document.activeElement?.textContent).toContain("Отмена");
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    });

    it("«Отмена» возвращает к подробностям и ставит фокус на «Отметить полученным»", async () => {
      await render(<OwnerCloseHarness />);

      const opener = control("Отметить полученным") as HTMLElement;
      await click(opener);
      await settle();
      expect(document.activeElement?.textContent).toContain("Отмена");

      await act(async () => {
        escape();
      });
      await settle();

      expect(body()).toContain("Кто видит");
      expect(body()).not.toContain("Подарок «Плед» получен?");
      expect(document.activeElement).toBe(opener);
    });
  });

  /**
   * D-49 (CLE-124): the owner detail has no reservation labels at all, even when
   * the snapshot still carries an expired or awaiting phase.
   */
  it("истёкшая и ожидающая бронь: ни полосы, ни «Снять бронь», ни «Получил»", async () => {
    for (const ownerAction of ["EXPIRED_NO_REPLY", "CONFIRM_GIVEN"] as const) {
      await render(
        <WishDetailDialog
          open
          viewer="owner"
          snapshot={gift({ ownerAction, reservedBy: null, reservationLabel: null })}
          onClose={function noop() {}}
          onEdit={function noop() {}}
          onMarkReceived={vi.fn()}
        />,
      );

      expect(dialogElement()?.querySelector("[data-testid='owner-action-label']")).toBeNull();
      expect(control(getMessages("ru").app.gift.release.confirm)).toBeUndefined();
      expect(body()).not.toContain("Срок брони истёк");
      expect(body()).not.toContain("Ждёт вашего подтверждения");
      expect(body()).not.toContain("Не получал, оставить бронь");
      expect(control("Отметить полученным")).toBeDefined();
    }
  });
});
