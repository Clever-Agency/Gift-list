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
    edit: string;
    editWithTags: string;
  };
};

/** `app.gift.visibilityChipLabel` with the lower-case visibility word. */
function chipLabel(visibility: GiftCardData["visibility"]): string {
  return app.gift.visibilityChipLabel.replace("{value}", app.gift.visibilityLower[visibility]);
}

/** The card's accessible name, from the same catalogue the app ships. */
function editLabel(tags: readonly string[]): string {
  const title = "Наушники";
  return tags.length > 0
    ? app.gift.editWithTags.replace("{title}", title).replace("{tags}", tags.join(", "))
    : app.gift.edit.replace("{title}", title);
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

const EDIT = '[role="button"][aria-label="Изменить «Наушники»"]';

/**
 * Story 2.2 + CLE-65: the card stays presentational: the list passes `onPress` to
 * open the edit route, and only then is the whole card a button. The listitem
 * wrapper stays outside either way, so a non-owner list can reuse the card without
 * a handler.
 */
describe("WishCard: нажатие", () => {
  it("с onPress вся карточка — кнопка с подписью «Изменить «{title}»» и зовёт onPress", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const item = container.querySelector('[role="listitem"]');
    expect(item).not.toBeNull();

    const card = item?.querySelector(EDIT);
    expect(card).not.toBeNull();
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

    const card = container.querySelector(EDIT);
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

    const card = container.querySelector(EDIT);
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
 * the chip is a button of its own only on an `OPEN` wish. CLE-65 draws it over the
 * card's reserved footer from a sibling layer, never from inside the card button.
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
    const edit = item?.querySelector(EDIT);
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
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Изменить «Наушники»");
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
    expect(layer?.previousElementSibling).toBe(item?.querySelector(EDIT));
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

  it("RESERVED + onPress: чип не кнопка, слой пропускает нажатие в карточку", async () => {
    const onPress = vi.fn();
    await render(gift({ status: "RESERVED", visibility: "FRIENDS" }), onPress, vi.fn());

    // Only the card is a button.
    const buttons = Array.from(container.querySelectorAll('[role="button"]'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Изменить «Наушники»");
    expect(container.querySelector(`[aria-label="${chipLabel("FRIENDS")}"]`)).toBeNull();

    const label = Array.from(container.querySelectorAll("span")).find(
      (node) => node.textContent === "Друзьям",
    );
    // The chip box is the label's parent, the layer above it lets every press through.
    const layer = label?.parentElement?.parentElement ?? null;
    expect(layer).not.toBeNull();
    expect(getComputedStyle(layer as Element).pointerEvents).toBe("none");
    expect(textOf()).toContain("Забронирован");
  });

  it.each([
    { status: "RESERVED" as const, pill: "Забронирован" },
    { status: "CLOSED" as const, pill: "Получен" },
  ])("$status: чип не кнопка, статус и видимость на месте", async ({ status, pill }) => {
    const onVisibilityPress = vi.fn();
    await render(gift({ status, visibility: "FRIENDS" }), undefined, onVisibilityPress);

    // No button at all: neither the card (no onPress) nor the chip.
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(container.querySelector(`[aria-label="${chipLabel("FRIENDS")}"]`)).toBeNull();
    expect(textOf()).toContain(pill);
    expect(textOf()).toContain("Друзьям");
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

  it("все теги входят в доступное имя карточки, действие прежнее", async () => {
    const onPress = vi.fn();
    const labels = ["мечта", "нужно сейчас", "когда-нибудь", "своё", "ещё одно"];
    const tags = labels.map(function tagOfLabel(label, index) {
      return {
        catalogId: index < 3 ? `tag_${index}` : null,
        label,
      };
    });
    await render(gift({ tags }), onPress);

    const card = container.querySelector(
      `[role="button"][aria-label="${editLabel(labels)}"]`,
    );
    expect(card).not.toBeNull();
    // Tags behind «+N» are still announced through the card name.
    for (const hiddenLabel of ["своё", "ещё одно"]) {
      expect(textOf()).not.toContain(hiddenLabel);
      expect(card?.getAttribute("aria-label")).toContain(hiddenLabel);
    }

    await click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
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
