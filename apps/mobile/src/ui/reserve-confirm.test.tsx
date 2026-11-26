// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, settle } from "@/test/dom";
import { addCalendarDays, todayInZone } from "@/ui/reservation-extend-dialog";
import { ReserveConfirm, defaultDueOn } from "./reserve-confirm";

const catalog = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../..", "packages/contracts/src/i18n/ru/app.json"),
    "utf8",
  ),
) as {
  gift: {
    reserveConfirm: Record<string, string>;
    reserveNoButton: Record<string, string>;
    reserveCta: string;
  };
  reservations: Record<string, string>;
};

vi.mock("use-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const group =
      namespace === "app.gift.reserveConfirm"
        ? catalog.gift.reserveConfirm
        : namespace === "app.reservations"
          ? catalog.reservations
          : {};
    const text = group[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  },
  useLocale: () => "ru",
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("reserve confirm defaults", () => {
  it("offers today+7 in the giver's zone", () => {
    const now = new Date("2026-06-15T21:30:00.000Z");
    expect(defaultDueOn("Europe/Moscow", now)).toBe("2026-06-23");
    expect(defaultDueOn("UTC", now)).toBe("2026-06-22");
  });

  it("uses the spec copy for the switch and the missing button", () => {
    expect(catalog.gift.reserveCta).toBe("Куплю сам");
    // CLE-124/D-49: the owner switch is gone; only the guests' switch stays.
    expect(catalog.gift.reserveConfirm.showOwner).toBeUndefined();
    expect(catalog.gift.reserveConfirm.showOthers).toBe("Показывать другим гостям, что дарю я");
    // CLE-124/S9b-1: no hint promises that «Купил» protects the reservation.
    expect(catalog.gift.reserveConfirm.boughtHint).toBeUndefined();
    expect(catalog.gift.reserveNoButton).toEqual({
      UNLIMITED: "Можно дарить без брони",
      RESERVED: "Уже забронирован",
      CLOSED: "Уже подарено",
    });
  });
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
  await settle(20);
}

function switches(): HTMLElement[] {
  return Array.from(dialogElement()?.querySelectorAll<HTMLElement>('[role="switch"]') ?? []);
}

const noop = function noop() {};

/** Story 5.1 / CLE-124/D-49: the reserve window has only the guests' switch. */
describe("ReserveConfirm", () => {
  it("shows one switch — «Показывать другим гостям, что дарю я» — and no owner switch", async () => {
    await render(
      <ReserveConfirm open title="Плед" timeZone="Europe/Minsk" onClose={noop} onConfirm={noop} />,
    );

    expect(dialogElement()).not.toBeNull();
    expect(switches()).toHaveLength(1);
    expect(switches()[0]?.getAttribute("aria-label")).toBe(
      "Показывать другим гостям, что дарю я",
    );
    expect(dialogElement()?.textContent ?? "").not.toContain("Показать владельцу");
  });

  /**
   * CLE-124/S9b-3 (§10.3, DESIGN → ReserveConfirm): under the date — the release
   * run-off line; the 30-day cap caption stays.
   */
  it("под датой — строка о снятии через 7 дней и потолок «Не позже»", async () => {
    await render(
      <ReserveConfirm open title="Плед" timeZone="Europe/Minsk" onClose={noop} onConfirm={noop} />,
    );

    const text = dialogElement()?.textContent ?? "";
    expect(text).toContain("Если не продлить, бронь снимется через 7 дней после этой даты");
    expect(text).toContain("Не позже");
  });

  /** D-60: the deadline is our `DateField` — visible label, bounds, no clear button. */
  it("дата — наше поле с подписью, границами и без кнопки очистки", async () => {
    await render(
      <ReserveConfirm open title="Плед" timeZone="Europe/Minsk" onClose={noop} onConfirm={noop} />,
    );

    const input = dialogElement()?.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input).not.toBeNull();
    expect(dialogElement()?.querySelector(`label[for="${input?.id}"]`)?.textContent).toContain(
      "Подарю до,",
    );
    expect(input?.getAttribute("aria-label")).toBeNull();

    const min = todayInZone("Europe/Minsk");
    expect(input?.min).toBe(min);
    expect(input?.max).toBe(addCalendarDays(min, 30));

    const described = input?.getAttribute("aria-describedby");
    const hint = dialogElement()?.querySelector(`[id="${described}"]`);
    expect(hint?.textContent).toContain("Не позже");
    expect(dialogElement()?.textContent).not.toContain("Убрать дату");
  });

  it("sends the guests' switch without the removed owner flag", async () => {
    const onConfirm = vi.fn();
    await render(
      <ReserveConfirm open title="Плед" timeZone="Europe/Minsk" onClose={noop} onConfirm={onConfirm} />,
    );

    await click(switches()[0]);
    const confirm = Array.from(dialogElement()?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [])
      .find((node) => (node.textContent ?? "").includes("Подтвердить"));
    await click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      dueOn: expect.any(String),
      holderVisibleToOthers: false,
    });
  });
});
