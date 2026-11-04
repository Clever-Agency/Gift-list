// @vitest-environment happy-dom
import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors, spacing } from "@/theme/tokens";
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
  };
};

/** `app.gift.visibilityChipLabel` with the lower-case visibility word. */
function chipLabel(visibility: GiftCardData["visibility"]): string {
  return app.gift.visibilityChipLabel.replace("{value}", app.gift.visibilityLower[visibility]);
}

/**
 * Every `Text` the card rendered, with its style, so the markup stays a plain DOM tree.
 * `styles` keeps the style of each rendered box by node, so layout promises (the
 * reserved footer, the absolute chip layer) are checked without a layout engine.
 */
const ui = vi.hoisted(() => ({
  texts: [] as { value: string; style: unknown }[],
  styles: new WeakMap<Element, unknown>(),
}));

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
vi.mock("react-native", async () => {
  const React = await import("react");
  type Props = {
    children?: React.ReactNode;
    style?: unknown;
    role?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    pointerEvents?: string;
    onPress?: () => void;
    "aria-haspopup"?: string;
  };
  /** Keeps the style of a rendered box, so the tests can flatten it later. */
  function recordStyle(style: unknown) {
    return (node: HTMLElement | null) => {
      if (node) ui.styles.set(node, style);
    };
  }
  /** `Pressable` takes `({ pressed }) => style`; the resting state is enough here. */
  function pressableStyle(style: unknown): unknown {
    return typeof style === "function"
      ? (style as (state: { pressed: boolean }) => unknown)({ pressed: false })
      : style;
  }
  function domProps(role?: string, accessibilityLabel?: string) {
    return {
      ...(role ? { role } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
    };
  }
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    View: ({ children, role, accessibilityLabel, pointerEvents, style }: Props) =>
      React.createElement(
        "div",
        {
          ref: recordStyle(style),
          ...domProps(role, accessibilityLabel),
          // `pointerEvents` is a View prop: react-native-web turns it into CSS.
          ...(pointerEvents ? { "data-pointer-events": pointerEvents } : {}),
        },
        children,
      ),
    Text: ({ children, style }: Props) => {
      if (typeof children === "string") ui.texts.push({ value: children, style });
      return React.createElement("span", null, children);
    },
    // `react-native-web` renders `Pressable` as `div role="button"`, focused by Tab,
    // and Enter/Space activate it; the mock keeps that shape so the keyboard paths
    // and the Tab order are testable. The card is a button only when `onPress` is
    // passed: the DOM role and name are what the screen reader would get.
    Pressable: ({
      children,
      role,
      accessibilityRole,
      accessibilityLabel,
      onPress,
      style,
      "aria-haspopup": ariaHaspopup,
    }: Props) => {
      function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.key === " ") event.preventDefault();
        onPress?.();
      }
      return React.createElement(
        "div",
        {
          ref: recordStyle(pressableStyle(style)),
          role: role ?? accessibilityRole ?? "button",
          tabIndex: 0,
          onClick: onPress,
          onKeyDown: handleKeyDown,
          ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
          ...(ariaHaspopup ? { "aria-haspopup": ariaHaspopup } : {}),
        },
        children,
      );
    },
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

/** Style arrays are plain objects here: `StyleSheet.create` is the identity in the mock. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, part) => ({ ...acc, ...flattenStyle(part) }),
      {},
    );
  }
  return typeof style === "object" && style !== null
    ? { ...(style as Record<string, unknown>) }
    : {};
}

/** The flattened style the mock recorded for a rendered box. */
function styleOf(node: Element | null | undefined): Record<string, unknown> {
  return flattenStyle(node ? ui.styles.get(node) : undefined);
}

function textNodes() {
  return ui.texts.map((entry) => entry.value);
}

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  ui.texts.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

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
  /** `DESIGN.md` → WishCard: a closed wish is muted and still spells out the status. */
  it("CLOSED: заголовок приглушён, pill «Получен»", async () => {
    await render(gift({ title: "Свитер", status: "CLOSED" }));

    const title = ui.texts.find((entry) => entry.value === "Свитер");
    expect(flattenStyle(title?.style).color).toBe(colors["muted-foreground"]);
    expect(textNodes()).toContain("Получен");
    // Review M5: closing does not resurrect a holder who never shared the name.
    expect(textNodes().some((value) => value.startsWith("Берёт"))).toBe(false);
  });

  it("OPEN: заголовок обычным цветом, pill «Открыт»", async () => {
    await render(gift({ title: "Наушники", status: "OPEN" }));

    const title = ui.texts.find((entry) => entry.value === "Наушники");
    expect(flattenStyle(title?.style).color).toBe(colors.foreground);
    expect(textNodes()).toContain("Открыт");
  });

  it("RESERVED: pill «Забронирован» и подпись брони", async () => {
    await render(
      gift({
        status: "RESERVED",
        reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
      }),
    );

    expect(textNodes()).toContain("Забронирован");
    expect(textNodes()).toContain("Берёт Олег");
  });
});

describe("WishCard: цена", () => {
  it("цена рисуется через formatPrice в локали", async () => {
    await render(gift({ priceAmount: 250000, priceCurrency: "RUB" }));

    expect(textNodes()).toContain(formatPrice(250000, "RUB", "ru"));
  });

  it("без цены строки цены нет", async () => {
    await render(gift({ priceAmount: null, priceCurrency: null }));

    const values = textNodes();
    expect(values).not.toContain(formatPrice(250000, "RUB", "ru"));
    // Nothing that looks like a formatted amount: the title has no digits either.
    expect(values.some((value) => /\d/.test(value))).toBe(false);
  });

  /** The pair is all-or-nothing: an amount without a currency cannot be formatted. */
  it("сумма без валюты не рисуется", async () => {
    await render(gift({ priceAmount: 250000, priceCurrency: null }));

    expect(textNodes().some((value) => value.includes("₽"))).toBe(false);
    expect(textNodes().some((value) => /\d/.test(value))).toBe(false);
  });

  it("валюта без суммы не рисуется", async () => {
    await render(gift({ priceAmount: null, priceCurrency: "BYN" }));

    expect(textNodes().some((value) => value.includes("BYN"))).toBe(false);
    expect(textNodes().some((value) => /\d/.test(value))).toBe(false);
  });
});

/**
 * Story 2.2 + CLE-65: the card stays presentational — the list passes `onPress` to
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
    // The chip layer is positioned against the card (CLE-65).
    expect(styleOf(item).position).toBe("relative");

    const card = item?.querySelector('[role="button"][aria-label="Изменить «Наушники»"]');
    expect(card).not.toBeNull();
    // The press zone is the whole card, not only its top.
    expect(item?.firstElementChild).toBe(card);
    expect(styleOf(card).padding).toBe(spacing["card-padding"]);

    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /**
   * CLE-65 reproduction: a press on the empty footer space next to the chip did
   * nothing. That space is the reserved spacer inside the card button now.
   */
  it("зарезервированный спейсер футера лежит в кнопке и ведёт в редактирование", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const card = container.querySelector('[role="button"][aria-label="Изменить «Наушники»"]');
    const spacer = Array.from(card?.querySelectorAll("div") ?? []).find(
      (node) => styleOf(node).height === spacing["chip-height"],
    );
    expect(spacer).toBeDefined();
    // The old footer margin: the chip is drawn over this box, at the same place.
    expect(styleOf(spacer).marginTop).toBe((spacing["grid-gap"] * 3) / 4);

    await act(async () => {
      spacer?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("без onPress карточка не кнопка, но listitem остаётся", async () => {
    await render(gift({ title: "Свитер" }));

    expect(container.querySelector('[role="listitem"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(textNodes()).toContain("Свитер");
  });

  it("Enter на кнопке карточки открывает редактирование", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const card = container.querySelector('[role="button"][aria-label="Изменить «Наушники»"]');
    // Focusable in the Tab order, like react-native-web's Pressable.
    expect(card?.getAttribute("tabindex")).toBe("0");
    await act(async () => {
      card?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/**
 * Story 2.3 (`DESIGN.md` → VisibilityChip, `EXPERIENCE.md` → Visibility chip):
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
    const edit = item?.querySelector('[role="button"][aria-label="Изменить «Наушники»"]');
    const chip = item?.querySelector(`[role="button"][aria-label="${chipLabel("PUBLIC")}"]`);
    expect(edit).not.toBeNull();
    expect(chip).not.toBeNull();
    // Two separate siblings: the chip lives outside the edit button.
    expect(chip).not.toBe(edit);
    expect(edit?.contains(chip ?? null)).toBe(false);
    expect(chip?.getAttribute("aria-haspopup")).toBe("dialog");

    await act(async () => {
      chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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

  it("слой чипа абсолютный и пропускает нажатия вокруг чипа в карточку", async () => {
    const onPress = vi.fn();
    const onVisibilityPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress, onVisibilityPress);

    const item = container.querySelector('[role="listitem"]');
    const chip = container.querySelector(`[role="button"][aria-label="${chipLabel("PUBLIC")}"]`);
    const layer = chip?.parentElement ?? null;
    expect(layer).not.toBeNull();
    // The layer is transparent to presses, its chip is not.
    expect(layer?.getAttribute("data-pointer-events")).toBe("box-none");
    const layerStyle = styleOf(layer);
    expect(layerStyle.position).toBe("absolute");
    expect(layerStyle.left).toBe(spacing["card-padding"]);
    expect(layerStyle.bottom).toBe(spacing["card-padding"]);
    expect(Number(layerStyle.zIndex)).toBeGreaterThan(0);
    // The layer is the last child of the listitem, outside the card button.
    expect(layer?.parentElement).toBe(item);
    expect(layer?.previousElementSibling).toBe(
      item?.querySelector('[role="button"][aria-label="Изменить «Наушники»"]'),
    );
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
    // The chip root is the label's parent, the absolute layer is above it.
    const layer = label?.parentElement?.parentElement ?? null;
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("data-pointer-events")).toBe("none");
    expect(styleOf(layer).position).toBe("absolute");
    expect(textNodes()).toContain("Забронирован");
  });

  it.each([
    { status: "RESERVED" as const, pill: "Забронирован" },
    { status: "CLOSED" as const, pill: "Получен" },
  ])("$status: чип не кнопка, статус и видимость на месте", async ({ status, pill }) => {
    const onVisibilityPress = vi.fn();
    await render(
      gift({ status, visibility: "FRIENDS" }),
      undefined,
      onVisibilityPress,
    );

    // No button at all: neither the card (no onPress) nor the chip.
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(container.querySelector(`[aria-label="${chipLabel("FRIENDS")}"]`)).toBeNull();
    expect(textNodes()).toContain(pill);
    expect(textNodes()).toContain("Друзьям");
  });
});
