// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, settle, typeInto } from "@/test/dom";
import {
  ReservationExtendDialog,
  addCalendarDays,
  canExtendReservation,
  defaultExtendDueOn,
  extendBounds,
  todayInZone,
} from "@/ui/reservation-extend-dialog";

const catalog = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "packages/contracts/src/i18n/ru/app.json",
    ),
    "utf8",
  ),
) as { reservations: Record<string, string> };

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const text = catalog.reservations[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  },
  useLocale: () => "ru",
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function body(): string {
  return dialogElement()?.textContent ?? "";
}

function control(label: string): HTMLElement | undefined {
  return Array.from(
    dialogElement()?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [],
  ).find((node) => (node.textContent ?? "").includes(label));
}

function dateInput(): HTMLInputElement | null {
  return dialogElement()?.querySelector<HTMLInputElement>('input[type="date"]') ?? null;
}

const noop = function noop() {};

/**
 * Story 5.5 (AD-9): «Продлить до…» — дата в диапазоне сегодня…сегодня+30 в поясе
 * держателя, подпись «Не позже {max}» и ошибка дня из `params.max`.
 */
describe("ReservationExtendDialog", () => {
  it("показывает дату, подпись максимума и обе кнопки", async () => {
    await render(
      <ReservationExtendDialog
        open
        timeZone="Europe/Minsk"
        onClose={noop}
        onConfirm={noop}
      />,
    );

    expect(dialogElement()).not.toBeNull();
    expect(body()).toContain("Продлить до…");
    expect(body()).toContain("Новая дата");
    expect(body()).toContain("Не позже");
    // CLE-124/S9b-3 (§10.3): the line under the date names the release run-off.
    expect(body()).toContain("Если не продлить, бронь снимется через 7 дней после этой даты");
    expect(control("Подтвердить")).toBeDefined();
    expect(control("Отмена")).toBeDefined();
    // День не раньше сегодняшнего в поясе держателя.
    const input = dateInput();
    expect(input?.min).toBe(todayInZone("Europe/Minsk"));
    expect(input?.max).toBe(extendBounds("Europe/Minsk").maxDue);
  });

  it("«Подтвердить» отдаёт выбранный день", async () => {
    const onConfirm = vi.fn();
    await render(
      <ReservationExtendDialog open timeZone="UTC" onClose={noop} onConfirm={onConfirm} />,
    );

    const input = dateInput();
    expect(input).not.toBeNull();
    const bounds = extendBounds("UTC");
    await typeInto(input!, bounds.minDue);
    await click(control("Подтвердить"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(bounds.minDue);
  });

  it("«Отмена» закрывает без отправки", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    await render(
      <ReservationExtendDialog open timeZone="UTC" onClose={onClose} onConfirm={onConfirm} />,
    );

    await click(control("Отмена"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("пока запрос в полёте, обе кнопки заняты и второй раз не отправляют", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    await render(
      <ReservationExtendDialog
        open
        busy
        timeZone="UTC"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const confirm = control("Подтвердить");
    expect(confirm?.getAttribute("aria-busy")).toBe("true");
    await click(confirm);
    await click(control("Отмена"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ошибка дня показывается подсказкой поля", async () => {
    await render(
      <ReservationExtendDialog
        open
        timeZone="UTC"
        dateError="Выберите дату не позже 20.12.2026."
        onClose={noop}
        onConfirm={noop}
      />,
    );

    expect(body()).toContain("Выберите дату не позже 20.12.2026.");
    // Поле даты подписано: доступное имя — заголовок действия, а не пустое поле.
    expect(dateInput()?.getAttribute("aria-label")).toBe("Продлить до…");
  });

  /**
   * R1 (CLE-119): «Продлить» открывается на текущем сроке брони, а не на
   * «сегодня + 7», иначе подтверждение без правки сокращало бы бронь.
   */
  it("по умолчанию показывает текущий срок брони внутри окна", async () => {
    const bounds = extendBounds("UTC");
    const current = addCalendarDays(bounds.minDue, 20);

    await render(
      <ReservationExtendDialog
        open
        timeZone="UTC"
        currentDueOn={current}
        onClose={noop}
        onConfirm={noop}
      />,
    );

    expect(dateInput()?.value).toBe(current);
  });

  it("без currentDueOn оставляет прежний день «сегодня + 7»", async () => {
    const bounds = extendBounds("UTC");

    await render(
      <ReservationExtendDialog open timeZone="UTC" onClose={noop} onConfirm={noop} />,
    );

    expect(dateInput()?.value).toBe(addCalendarDays(bounds.minDue, 7));
  });
});

describe("canExtendReservation", () => {
  // Полдень UTC: день в UTC и в Europe/Minsk совпадает, тест не зависит от часа.
  const now = new Date("2026-06-15T10:00:00.000Z");
  const active = { dueAt: "2026-06-20", phase: "ACTIVE" as const };

  it("ACTIVE до срока — продление можно", () => {
    expect(canExtendReservation(active, "UTC", now)).toBe(true);
    // Срок — это конец выбранного дня, поэтому сам день ещё не прошёл.
    expect(canExtendReservation({ ...active, dueAt: "2026-06-15" }, "UTC", now)).toBe(true);
  });

  it("ACTIVE после срока — продления нет", () => {
    expect(canExtendReservation({ ...active, dueAt: "2026-06-14" }, "UTC", now)).toBe(false);
  });

  it("AWAITING_* и GIVEN — продления нет даже с будущим сроком", () => {
    for (const phase of ["AWAITING_GIVER", "AWAITING_OWNER", "GIVEN"] as const) {
      expect(canExtendReservation({ dueAt: "2026-06-20", phase }, "UTC", now)).toBe(false);
    }
  });

  it("день считается в поясе держателя", () => {
    // 21:30 UTC — в Москве уже 16 июня.
    const late = new Date("2026-06-15T21:30:00.000Z");
    expect(canExtendReservation({ ...active, dueAt: "2026-06-15" }, "UTC", late)).toBe(true);
    expect(canExtendReservation({ ...active, dueAt: "2026-06-15" }, "Europe/Moscow", late)).toBe(
      false,
    );
  });
});

describe("extend bounds", () => {
  it("сегодня и сегодня+30 — календарные дни пояса держателя", () => {
    const now = new Date("2026-06-15T21:30:00.000Z");
    expect(todayInZone("Europe/Moscow", now)).toBe("2026-06-16");
    expect(todayInZone("UTC", now)).toBe("2026-06-15");
    expect(extendBounds("UTC", now)).toEqual({ minDue: "2026-06-15", maxDue: "2026-07-15" });
  });

  it("переход через конец месяца и года", () => {
    expect(addCalendarDays("2026-12-20", 30)).toBe("2027-01-19");
    expect(addCalendarDays("2027-02-01", 30)).toBe("2027-03-03");
  });
});

describe("defaultExtendDueOn", () => {
  // Полдень UTC: день в UTC и в Europe/Minsk совпадает, тест не зависит от часа.
  const now = new Date("2026-06-15T10:00:00.000Z");

  it("без currentDueOn — прежний «сегодня + 7»", () => {
    expect(defaultExtendDueOn("UTC", undefined, now)).toBe("2026-06-22");
  });

  it("текущий срок внутри окна остаётся по умолчанию", () => {
    expect(defaultExtendDueOn("UTC", "2026-07-01", now)).toBe("2026-07-01");
    expect(defaultExtendDueOn("UTC", "2026-06-15", now)).toBe("2026-06-15");
    expect(defaultExtendDueOn("UTC", "2026-07-15", now)).toBe("2026-07-15");
  });

  it("срок за окном прижимается к [сегодня, сегодня + 30]", () => {
    expect(defaultExtendDueOn("UTC", "2026-05-01", now)).toBe("2026-06-15");
    expect(defaultExtendDueOn("UTC", "2026-09-01", now)).toBe("2026-07-15");
  });

  it("нечитаемый currentDueOn — прежнее поведение", () => {
    for (const value of ["", "2026-7-1", "2026-07-01T00:00:00.000Z", "next week"]) {
      expect(defaultExtendDueOn("UTC", value, now)).toBe("2026-06-22");
    }
  });
});
