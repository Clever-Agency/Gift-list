// @vitest-environment happy-dom
import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click } from "@/test/dom";
import { WishCard } from "@/ui/gift-card";

/** The same catalogue the app ships, so the accessible name is not copied here. */
const app = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "packages/contracts/src/i18n/ru/app.json",
    ),
    "utf8",
  ),
) as {
  gift: {
    visibilityLower: Record<string, string>;
    visibilityChipLabel: string;
    visibilityInCardName: string;
    status: Record<string, string>;
    ownerAction: Record<string, string>;
  };
  myWishlist: { reservedBy: string };
};

/** `app.gift.visibilityChipLabel` with the lower-case visibility word. */
function chipLabel(visibility: GiftCardData["visibility"]): string {
  return app.gift.visibilityChipLabel.replace("{value}", app.gift.visibilityLower[visibility]);
}

/** The card's `DESIGN.md` phrase, from the same catalogue the app ships. */
function cardLabel(card: GiftCardData): string {
  const price =
    card.priceAmount !== null && card.priceCurrency !== null
      ? formatPrice(card.priceAmount, card.priceCurrency, "ru")
      : null;
  const reservation = card.ownerAction
    ? app.gift.ownerAction[card.ownerAction]
    : card.reservedBy
      ? app.myWishlist.reservedBy.replace("{name}", card.reservedBy.displayName)
      : null;
  return [
    card.title,
    price,
    app.gift.status[card.status],
    card.tags.length > 0
      ? card.tags
          .map(function labelOfTag(tag) {
            return tag.label;
          })
          .join(", ")
      : null,
    reservation,
    app.gift.visibilityInCardName.replace("{value}", app.gift.visibilityLower[card.visibility]),
  ]
    .filter(function hasText(part): part is string {
      return part !== null && part.trim() !== "";
    })
    .join(", ");
}

vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: () => React.createElement("span", { "data-testid": "visibility-icon" }),
  };
});
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(root, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
    ) as Record<string, unknown>;
  }
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  /** `app.gift.status` resolves the same way `useTranslations` prefixes a namespace. */
  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? catalogs.common : catalogs.app;
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      base,
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

function gift(overrides: Partial<GiftCardData> = {}): GiftCardData {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
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

function textOf(): string {
  return container.textContent ?? "";
}

async function render(
  card: GiftCardData,
  onPress?: () => void,
  onVisibilityPress?: () => void,
) {
  await act(async () => {
    host.render(
      <WishCard
        gift={card}
        width={343}
        onPress={onPress}
        onVisibilityPress={onVisibilityPress}
      />,
    );
  });
}

describe("WishCard: статус", () => {
  /** `DESIGN.md` -> WishCard: a closed wish still spells out the status. */
  it("CLOSED: pill «Получен», без «Берёт»", async () => {
    await render(gift({ title: "Свитер", status: "CLOSED" }));

    expect(textOf()).toContain("Свитер");
    expect(textOf()).toContain("Получен");
    // Review M5: closing does not resurrect a holder who never shared the name.
    expect(textOf()).not.toContain("Берёт");
  });

  it("OPEN: pill «Открыт»", async () => {
    await render(gift({ title: "Наушники", status: "OPEN" }));

    expect(textOf()).toContain("Наушники");
    expect(textOf()).toContain("Открыт");
  });

  it("RESERVED: pill «Забронирован» и подпись брони", async () => {
    await render(
      gift({
        status: "RESERVED",
        reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
      }),
    );

    expect(textOf()).toContain("Забронирован");
    expect(textOf()).toContain("Берёт Олег");
  });
});

describe("WishCard: цена", () => {
  it("цена рисуется через formatPrice в локали", async () => {
    await render(gift({ priceAmount: 250000, priceCurrency: "RUB" }));

    expect(textOf()).toContain(formatPrice(250000, "RUB", "ru"));
  });

  it("без цены строки цены нет", async () => {
    await render(gift({ priceAmount: null, priceCurrency: null }));

    expect(textOf()).not.toContain(formatPrice(250000, "RUB", "ru"));
    // Nothing that looks like a formatted amount: the title has no digits either.
    expect(/\d/.test(textOf())).toBe(false);
  });

  /** The pair is all-or-nothing: an amount without a currency cannot be formatted. */
  it("сумма без валюты не рисуется", async () => {
    await render(gift({ priceAmount: 250000, priceCurrency: null }));

    expect(textOf()).not.toContain("₽");
    expect(/\d/.test(textOf())).toBe(false);
  });

  it("валюта без суммы не рисуется", async () => {
    await render(gift({ priceAmount: null, priceCurrency: "BYN" }));

    expect(textOf()).not.toContain("BYN");
    expect(/\d/.test(textOf())).toBe(false);
  });
});

/** The card button is the first button of the list item; the clickable chip is its sibling. */
const CARD = '[role="listitem"] > [role="button"]';

/** `DESIGN.md` → Доступность: one phrase for the pressable main zone. */
describe("WishCard: доступное имя", () => {
  it("название, цена, статус, все теги, строка брони и видимость — в этом порядке", async () => {
    const cardData = gift({
      title: "Наушники",
      priceAmount: 250000,
      priceCurrency: "RUB",
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
      visibility: "PUBLIC",
      tags: [
        { catalogId: "tag_dream", label: "мечта" },
        { catalogId: "tag_need_now", label: "нужно сейчас" },
        { catalogId: "tag_someday", label: "когда-нибудь" },
        { catalogId: null, label: "своё" },
        { catalogId: null, label: "ещё одно" },
      ],
    });
    await render(cardData, vi.fn());

    const card = container.querySelector(CARD);
    expect(card?.getAttribute("aria-label")).toBe(
      [
        "Наушники",
        formatPrice(250000, "RUB", "ru"),
        "Забронирован",
        "мечта, нужно сейчас, когда-нибудь, своё, ещё одно",
        "Берёт Олег",
        "видимость всем",
      ].join(", "),
    );
  });

  it.each([
    { ownerAction: "CONFIRM_GIVEN" as const, line: "Ждёт вашего подтверждения" },
    { ownerAction: "EXPIRED_NO_REPLY" as const, line: "Срок брони истёк" },
  ])("$ownerAction: фаза брони вытесняет имя держателя", async ({ ownerAction, line }) => {
    const cardData = gift({
      status: "RESERVED",
      ownerAction,
      reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
    });
    await render(cardData, vi.fn());

    const label = container.querySelector(CARD)?.getAttribute("aria-label") ?? "";
    expect(label).toBe(
      `Наушники, ${formatPrice(250000, "RUB", "ru")}, Забронирован, ${line}, видимость всем`,
    );
    expect(label).not.toContain("Берёт Олег");
  });

  it("пустые части опускаются: без цены, тегов и брони лишних запятых нет", async () => {
    const cardData = gift({
      priceAmount: null,
      priceCurrency: null,
      status: "OPEN",
      tags: [],
      reservedBy: null,
      visibility: "SECRET",
    });
    await render(cardData, vi.fn());

    const card = container.querySelector(CARD);
    expect(card?.getAttribute("aria-label")).toBe(
      "Наушники, Открыт, видимость секрет",
    );
  });

  it("имя обновляется вместе с данными карточки", async () => {
    const onPress = vi.fn();
    const first = gift({ title: "Наушники", status: "OPEN", tags: [] });
    await render(first, onPress);
    expect(container.querySelector(CARD)?.getAttribute("aria-label")).toBe(
      `Наушники, ${formatPrice(250000, "RUB", "ru")}, Открыт, видимость всем`,
    );

    const second = gift({
      title: "Свитер",
      status: "CLOSED",
      tags: [{ catalogId: null, label: "тёплое" }],
      visibility: "FRIENDS",
    });
    await render(second, onPress);
    const card = container.querySelector(CARD);
    expect(card?.getAttribute("aria-label")).toBe(
      `Свитер, ${formatPrice(250000, "RUB", "ru")}, Получен, тёплое, видимость друзьям`,
    );
    expect(card?.getAttribute("aria-label")).toBe(cardLabel(second));
    expect(card?.getAttribute("aria-label")).not.toContain("Наушники");
  });

  it("без onPress общего имени нет: карточка не кнопка", async () => {
    await render(gift({ tags: [{ catalogId: null, label: "своё" }] }));

    expect(container.querySelector(CARD)).toBeNull();
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });
});

/**
 * Story 2.2 + CLE-65: the card stays presentational: the list passes `onPress` to
 * open the edit route, and only then is the whole card a button. The listitem
 * wrapper stays outside either way, so a non-owner list can reuse the card without
 * a handler.
 */
describe("WishCard: нажатие", () => {
  it("с onPress вся карточка — кнопка с полным именем по DESIGN и зовёт onPress", async () => {
    const onPress = vi.fn();
    const cardData = gift({ title: "Наушники" });
    await render(cardData, onPress);

    const item = container.querySelector('[role="listitem"]');
    expect(item).not.toBeNull();

    const card = item?.querySelector(CARD);
    expect(card).not.toBeNull();
    expect(card?.getAttribute("aria-label")).toBe(
      `Наушники, ${formatPrice(250000, "RUB", "ru")}, Открыт, видимость всем`,
    );
    // The press zone is the whole card: the button is the first thing in the item.
    expect(item?.firstElementChild).toBe(card);

    await click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /**
   * CLE-65 reproduction: a press on the empty footer space next to the chip did
   * nothing. That space is the reserved spacer inside the card button now.
   */
  it("зарезервированный спейсер футера лежит в кнопке и ведёт в редактирование", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const card = container.querySelector(CARD);
    // The spacer is the last box of the card button, with no text of its own.
    const spacer = card?.lastElementChild;
    expect(spacer).not.toBeNull();
    expect(spacer?.textContent).toBe("");

    await click(spacer);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("без onPress карточка не кнопка, но listitem остаётся", async () => {
    await render(gift({ title: "Свитер" }));

    expect(container.querySelector('[role="listitem"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(textOf()).toContain("Свитер");
  });

  it("Enter на кнопке карточки открывает редактирование", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const card = container.querySelector(CARD);
    // Focusable in the Tab order.
    expect(card?.getAttribute("tabindex")).toBe("0");
    await act(async () => {
      card?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/**
 * Story 2.3 (`DESIGN.md` -> VisibilityChip, `EXPERIENCE.md` -> Visibility chip):
 * the chip is a button of its own on an `OPEN` or `RESERVED` wish, and a plain value
 * on a `CLOSED` or archived one (CLE-82/S23.3). CLE-65 draws it over the card's
 * reserved footer from a sibling layer, never from inside the card button.
 */
describe("WishCard: чип видимости", () => {
  it("OPEN + onVisibilityPress: чип — соседняя кнопка, зовёт обработчик и не открывает правку", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(
      gift({ title: "Наушники", status: "OPEN", visibility: "PUBLIC" }),
      onPress,
      onVisibilityPress,
    );

    const item = container.querySelector('[role="listitem"]');
    const edit = item?.querySelector(CARD);
    const chip = item?.querySelector(`[role="button"][aria-label="${chipLabel("PUBLIC")}"]`);
    expect(edit).not.toBeNull();
    expect(chip).not.toBeNull();
    // Two separate siblings: the chip lives outside the edit button.
    expect(chip).not.toBe(edit);
    expect(edit?.contains(chip ?? null)).toBe(false);
    expect(chip?.getAttribute("aria-haspopup")).toBe("dialog");

    await click(chip);
    expect(onVisibilityPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("в DOM кнопка карточки идёт раньше чипа: Tab сначала на карточку", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress, onVisibilityPress);

    const item = container.querySelector('[role="listitem"]');
    const buttons = Array.from(item?.querySelectorAll('[role="button"]') ?? []);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute("aria-label")).toBe(
      cardLabel(gift({ title: "Наушники", visibility: "PUBLIC" })),
    );
    expect(buttons[1]?.getAttribute("aria-label")).toBe(chipLabel("PUBLIC"));
    // Both are reachable by Tab, in that order.
    expect(buttons.every((node) => node.getAttribute("tabindex") === "0")).toBe(true);
  });

  it("слой чипа лежит соседом кнопки карточки, а не внутри неё", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress, onVisibilityPress);

    const item = container.querySelector('[role="listitem"]');
    const chip = container.querySelector(`[role="button"][aria-label="${chipLabel("PUBLIC")}"]`);
    const layer = chip?.parentElement ?? null;
    expect(layer).not.toBeNull();
    // The layer is the last child of the listitem, outside the card button.
    expect(layer?.parentElement).toBe(item);
    expect(layer?.previousElementSibling).toBe(item?.querySelector(CARD));
    // It takes no presses itself: the ones around the chip reach the card button.
    expect(getComputedStyle(layer as Element).pointerEvents).toBe("none");
  });

  it("Enter и Space на чипе вызывают только onVisibilityPress", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress, onVisibilityPress);

    const chip = container.querySelector(`[role="button"][aria-label="${chipLabel("PUBLIC")}"]`);
    for (const key of ["Enter", " "]) {
      await act(async () => {
        chip?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
    }
    expect(onVisibilityPress).toHaveBeenCalledTimes(2);
    expect(onPress).not.toHaveBeenCalled();
  });

  /**
   * CLE-82/S23.3: a reserved wish may still change its visibility, so its chip is a
   * button. The press goes to the picker, never to the edit route.
   */
  it("RESERVED + onVisibilityPress: чип — кнопка рядом с карточкой и зовёт обработчик", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(
      gift({
        status: "RESERVED",
        visibility: "FRIENDS",
        reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
      }),
      onPress,
      onVisibilityPress,
    );

    const item = container.querySelector('[role="listitem"]');
    const chip = item?.querySelector(`[role="button"][aria-label="${chipLabel("FRIENDS")}"]`);
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute("aria-haspopup")).toBe("dialog");

    await click(chip);
    expect(onVisibilityPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(textOf()).toContain("Забронирован");
  });

  /**
   * A closed wish and an archived one are read-only as a whole (product
   * clarification t351u), so the handler passed by the list changes nothing: the
   * chip only shows the stored value.
   */
  it.each([
    { surface: "CLOSED", card: { status: "CLOSED" as const }, pill: "Получен" },
    {
      surface: "архив",
      card: { status: "OPEN" as const, archivedAt: "2026-10-01T00:00:00.000Z" },
      pill: "Открыт",
    },
  ])("$surface: чип не кнопка, статус и видимость на месте", async ({ card, pill }) => {
    const onVisibilityPress = vi.fn();
    await render(gift({ ...card, visibility: "FRIENDS" }), undefined, onVisibilityPress);

    // No button at all: neither the card (no onPress) nor the chip.
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(container.querySelector(`[aria-label="${chipLabel("FRIENDS")}"]`)).toBeNull();
    expect(textOf()).toContain(pill);
    expect(textOf()).toContain("Друзьям");
    expect(onVisibilityPress).not.toHaveBeenCalled();
  });
});

/**
 * Story 2.5.7 (`DESIGN.md` -> WishCard, `EXPERIENCE.md` -> Tags): up to three
 * chips and «+N»; labels come from the server DTO, so fixed tag captions are
 * never translated on the client and custom text stays as stored.
 */
describe("WishCard: теги", () => {
  it("показывает серверные подписи фиксированного и своего тега без клиентских переводов", async () => {
    await render(
      gift({
        tags: [
          { catalogId: "tag_dream", label: "подарок-сюрприз" },
          { catalogId: null, label: "своё" },
        ],
      }),
    );

    expect(textOf()).toContain("подарок-сюрприз");
    expect(textOf()).toContain("своё");
    // The fixed tag's label is exactly what the server sent, not a local caption.
    expect(textOf()).not.toContain("мечта");
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it("показывает до трёх тегов и «+N» для остальных", async () => {
    await render(
      gift({
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: "tag_need_now", label: "нужно сейчас" },
          { catalogId: "tag_someday", label: "когда-нибудь" },
          { catalogId: null, label: "своё" },
          { catalogId: null, label: "ещё одно" },
        ],
      }),
    );

    expect(textOf()).toContain("мечта");
    expect(textOf()).toContain("нужно сейчас");
    expect(textOf()).toContain("когда-нибудь");
    expect(textOf()).toContain("+2");
    expect(textOf()).not.toContain("своё");
    expect(textOf()).not.toContain("ещё одно");
    expect(container.querySelector('[data-testid="gift-tags"]')).not.toBeNull();
  });

  /** DESIGN.md -> WishCard: three chips fit, the fourth becomes «+1». */
  it("граница карточки: три тега без «+N»", async () => {
    await render(
      gift({
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: "tag_need_now", label: "нужно сейчас" },
          { catalogId: "tag_someday", label: "когда-нибудь" },
        ],
      }),
    );

    const row = container.querySelector('[data-testid="gift-tags"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.childElementCount).toBe(3);
    expect(textOf()).toContain("мечта");
    expect(textOf()).toContain("нужно сейчас");
    expect(textOf()).toContain("когда-нибудь");
    expect(container.querySelector('[data-testid="gift-tags-more"]')).toBeNull();
  });

  it("граница карточки: четвёртый тег даёт «+1» и скрыт из видимого ряда", async () => {
    await render(
      gift({
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: "tag_need_now", label: "нужно сейчас" },
          { catalogId: "tag_someday", label: "когда-нибудь" },
          { catalogId: null, label: "своё" },
        ],
      }),
    );

    const row = container.querySelector('[data-testid="gift-tags"]') as HTMLElement;
    expect(row.childElementCount).toBe(4);
    expect(container.querySelector('[data-testid="gift-tags-3"]')).toBeNull();
    expect(textOf()).not.toContain("своё");
    expect(container.querySelector('[data-testid="gift-tags-more"]')?.textContent).toBe("+1");
  });

  it("длинный свой тег виден целиком", async () => {
    const longTag = "очень длинный собственный тег";
    await render(gift({ tags: [{ catalogId: null, label: longTag }] }));

    expect(textOf()).toContain(longTag);
  });

  it("без тегов ряда нет", async () => {
    await render(gift({ tags: [] }));

    expect(container.querySelector('[data-testid="gift-tags"]')).toBeNull();
  });

  it("все теги входят в доступное имя карточки в порядке показа, действие прежнее", async () => {
    const onPress = vi.fn();
    const labels = ["мечта", "нужно сейчас", "когда-нибудь", "своё", "ещё одно"];
    const tags = labels.map(function tagOfLabel(label, index) {
      return {
        catalogId: index < 3 ? `tag_${index}` : null,
        label,
      };
    });
    const cardData = gift({ tags });
    await render(cardData, onPress);

    const card = container.querySelector(CARD);
    expect(card).not.toBeNull();
    expect(card?.getAttribute("aria-label")).toBe(cardLabel(cardData));
    // Tags behind «+N» are still announced through the card name.
    for (const hiddenLabel of ["своё", "ещё одно"]) {
      expect(textOf()).not.toContain(hiddenLabel);
      expect(card?.getAttribute("aria-label")).toContain(hiddenLabel);
    }

    await click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("визуальный порядок чипов не меняется: три подписи, затем «+N», без кнопок", async () => {
    await render(
      gift({
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: "tag_need_now", label: "нужно сейчас" },
          { catalogId: "tag_someday", label: "когда-нибудь" },
          { catalogId: null, label: "своё" },
          { catalogId: null, label: "ещё одно" },
        ],
      }),
    );

    const row = container.querySelector('[data-testid="gift-tags"]') as HTMLElement;
    expect(
      Array.from(row.children).map(function chipText(chip) {
        return chip.textContent;
      }),
    ).toEqual(["мечта", "нужно сейчас", "когда-нибудь", "+2"]);
    // The row is not a control and has no presses of its own.
    expect(row.getAttribute("role")).toBeNull();
    expect(row.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it("без onPress теги и «+N» доступны, лишних кнопок нет", async () => {
    await render(
      gift({
        status: "CLOSED",
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: null, label: "своё" },
          { catalogId: null, label: "ещё одно" },
          { catalogId: null, label: "четвёртое" },
        ],
      }),
    );

    expect(textOf()).toContain("Получен");
    expect(textOf()).toContain("мечта");
    expect(textOf()).toContain("+1");
    const more = container.querySelector('[data-testid="gift-tags-more"]') as HTMLElement;
    expect(more).not.toBeNull();
    expect(more.getAttribute("aria-label")).toContain("четвёртое");
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });
});
