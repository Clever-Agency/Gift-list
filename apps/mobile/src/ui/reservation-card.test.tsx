// @vitest-environment happy-dom
import type { ReservationCard as ReservationCardData } from "@gift-list/contracts";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, settle } from "@/test/dom";
import { addCalendarDays, todayInZone } from "@/ui/reservation-extend-dialog";
import { ReservationCard } from "@/ui/reservation-card";

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  function catalogFor(namespace: string): unknown {
    return namespace
      .split(".")
      .slice(1)
      .reduce<unknown>(
        (node, part) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        app,
      );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(catalogFor(namespace), key, values),
    useLocale: () => "ru",
  };
});

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

function card(overrides: Partial<ReservationCardData> = {}): ReservationCardData {
  return {
    giftId: "g1",
    titleSnapshot: "Плед из шерсти мериноса",
    status: "RESERVED",
    ownerNick: "anya",
    dueAt: "2026-12-01",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    canOpenGift: true,
    ...overrides,
  };
}

const noop = function noop() {};

/** A deadline day that is still ahead in `timeZone`: the card keeps «Продлить до…». */
function dueSoon(days = 5): string {
  return addCalendarDays(todayInZone("UTC"), days);
}

async function render(node: ReactNode) {
  await act(async () => {
    host.render(node);
  });
  await settle(10);
}

function text(): string {
  return container.textContent ?? "";
}

function control(label: string): HTMLElement | undefined {
  return Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"], [role="switch"]'),
  ).find((node) => (node.textContent ?? "").includes(label));
}

function byLabel(label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

/**
 * Story 5.5 (`DESIGN.md` → ReservationCard, `EXPERIENCE.md` → «Подписи брони»):
 * одна карточка брони держателя — снимок названия, @ник, срок, фаза, «Купил»,
 * «Продлить до…», переключатель «Показывать другим гостям, что дарю я» и ссылка на
 * деталь только при `canOpenGift`.
 */
describe("ReservationCard", () => {
  it("показывает снимок названия, ник владельца и срок фазы ACTIVE", async () => {
    await render(<ReservationCard card={card()} onBoughtChange={noop} onVisibilityChange={noop} />);

    expect(text()).toContain("Плед из шерсти мериноса");
    expect(text()).toContain("у @anya");
    // «Вы берёте · до DD.MM» — срок без года, отдельной строки «до …» нет (Story 5.5).
    expect(text()).toContain("Вы берёте · до 01.12");
  });

  it("показывает срок и подпись каждой незавершённой фазы", async () => {
    await render(
      <ReservationCard
        card={card({ phase: "AWAITING_GIVER" })}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );
    expect(text()).toContain("до 01.12");
    expect(text()).toContain("Срок истёк");

    await act(async () => {
      host.render(
        <ReservationCard
          card={card({ phase: "AWAITING_OWNER" })}
          onBoughtChange={noop}
          onVisibilityChange={noop}
        />,
      );
    });
    // CLE-124/S9b-3 (§10.6): the owner is no longer asked anything.
    expect(text()).toContain("Срок истёк");
    expect(text()).not.toContain("ждём ответа владельца");
  });

  it("чип «Куплено» и переключатель «Купил» отражают флаг, без подмены фазы", async () => {
    const onBoughtChange = vi.fn();
    await render(
      <ReservationCard
        card={card({ bought: true })}
        onBoughtChange={onBoughtChange}
        onVisibilityChange={noop}
      />,
    );

    expect(text()).toContain("Куплено");
    const bought = byLabel("Купил");
    expect(bought?.getAttribute("role")).toBe("switch");
    expect(bought?.getAttribute("aria-checked")).toBe("true");

    await click(bought);
    expect(onBoughtChange).toHaveBeenCalledWith(false);
  });

  it("в GIVEN нет «Продлить до…» и «Подарил», остальные действия на месте", async () => {
    const onExtend = vi.fn();
    const onGiven = vi.fn();
    await render(
      <ReservationCard
        card={card({ phase: "GIVEN" })}
        onExtend={onExtend}
        onGiven={onGiven}
        onMenu={noop}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    expect(text()).toContain("Подарено");
    expect(control("Продлить до…")).toBeUndefined();
    expect(control("Подарил")).toBeUndefined();
    expect(byLabel("Купил")).not.toBeNull();
    expect(byLabel("Показывать другим гостям, что дарю я")).not.toBeNull();
    expect(byLabel("Меню")).not.toBeNull();
  });

  it("в ACTIVE «Продлить до…» открывает диалог через колбэк", async () => {
    const onExtend = vi.fn();
    await render(
      <ReservationCard
        card={card({ dueAt: dueSoon() })}
        onExtend={onExtend}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    await click(control("Продлить до…"));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });

  /**
   * CLE-124/S9b-3 (D-12, §10.2): «Продлить до…» живёт только до Срока — после
   * него сервер отвечает `RESERVATION_DUE_PASSED`, поэтому кнопки нет.
   */
  it("после срока «Продлить до…» нет, а «Подарил» и остальные действия на месте", async () => {
    const onExtend = vi.fn();
    const onGiven = vi.fn();
    await render(
      <ReservationCard
        card={card({ dueAt: "2020-01-01" })}
        onExtend={onExtend}
        onGiven={onGiven}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    expect(control("Продлить до…")).toBeUndefined();
    await click(control("Подарил"));
    expect(onGiven).toHaveBeenCalledTimes(1);
    expect(byLabel("Купил")).not.toBeNull();
  });

  /** Story 5.7: «Подарил» — колбэк экрана, который заменит карточку ответом. */
  it("«Подарил» вызывает колбэк, а после ответа карточка читает «Подарено»", async () => {
    const onGiven = vi.fn();
    await render(
      <ReservationCard
        card={card({ dueAt: dueSoon() })}
        onGiven={onGiven}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    await click(control("Подарил"));
    expect(onGiven).toHaveBeenCalledTimes(1);

    await act(async () => {
      host.render(
        <ReservationCard
          card={card({ phase: "GIVEN" })}
          onGiven={onGiven}
          onBoughtChange={noop}
          onVisibilityChange={noop}
        />,
      );
    });
    expect(text()).toContain("Подарено");
    expect(control("Подарил")).toBeUndefined();
  });

  it("при canOpenGift основная зона — ссылка с названием желания", async () => {
    const onOpenGift = vi.fn();
    await render(
      <ReservationCard
        card={card()}
        onOpenGift={onOpenGift}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    const link = byLabel("Открыть желание «Плед из шерсти мериноса»");
    expect(link?.getAttribute("role")).toBe("link");
    await click(link);
    expect(onOpenGift).toHaveBeenCalledTimes(1);
  });

  it("без canOpenGift карточка не ссылается на деталь", async () => {
    const onOpenGift = vi.fn();
    await render(
      <ReservationCard
        card={card({ canOpenGift: false })}
        onOpenGift={onOpenGift}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    expect(container.querySelector('[role="link"]')).toBeNull();
    expect(container.querySelector('[aria-label^="Открыть желание"]')).toBeNull();
    expect(onOpenGift).not.toHaveBeenCalled();
    // Действия остаются: карточка самодостаточна после unfriend/Block (A-14).
    expect(byLabel("Купил")).not.toBeNull();
  });

  it("⋯ открывает меню и имеет доступное имя", async () => {
    const onMenu = vi.fn();
    await render(
      <ReservationCard
        card={card()}
        onMenu={onMenu}
        onBoughtChange={noop}
        onVisibilityChange={noop}
      />,
    );

    const menu = byLabel("Меню");
    expect(menu?.getAttribute("aria-haspopup")).toBe("dialog");
    await click(menu);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("переключатель «Показывать другим гостям, что дарю я» стоит прямо в карточке", async () => {
    const onVisibilityChange = vi.fn();
    await render(
      <ReservationCard
        card={card()}
        onBoughtChange={noop}
        onVisibilityChange={onVisibilityChange}
      />,
    );

    // «Купил» и видимость — без раскрывашки и без заголовка «Кто видит, что это я».
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(2);
    expect(container.querySelector("[aria-expanded]")).toBeNull();
    expect(text()).not.toContain("Кто видит, что это я");
    const others = byLabel("Показывать другим гостям, что дарю я");
    expect(others?.getAttribute("aria-checked")).toBe("true");

    await click(others);
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ holderVisibleToOthers: false });
  });

  it("пока карточка занята, её действия не отправляют второй запрос", async () => {
    const onBoughtChange = vi.fn();
    const onMenu = vi.fn();
    const onExtend = vi.fn();
    await render(
      <ReservationCard
        card={card()}
        busy
        onMenu={onMenu}
        onExtend={onExtend}
        onBoughtChange={onBoughtChange}
        onVisibilityChange={noop}
      />,
    );

    await click(byLabel("Купил"));
    await click(byLabel("Меню"));
    await click(control("Продлить до…"));
    expect(onBoughtChange).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
    expect(onExtend).not.toHaveBeenCalled();
  });
});
