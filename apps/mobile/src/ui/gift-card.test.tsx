// @vitest-environment happy-dom
import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors } from "@/theme/tokens";
import { WishCard } from "@/ui/gift-card";

/** Every `Text` the card rendered, with its style, so the markup stays a plain DOM tree. */
const ui = vi.hoisted(() => ({
  texts: [] as { value: string; style: unknown }[],
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
    accessibilityLabel?: string;
    onPress?: () => void;
  };
  const domProps = (role?: string, accessibilityLabel?: string) => ({
    ...(role ? { role } : {}),
    ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
  });
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    View: ({ children, role, accessibilityLabel }: Props) =>
      React.createElement("div", domProps(role, accessibilityLabel), children),
    Text: ({ children, style }: Props) => {
      if (typeof children === "string") ui.texts.push({ value: children, style });
      return React.createElement("span", null, children);
    },
    // The card content is a button only when `onPress` is passed: the mock keeps
    // the DOM role and name the screen reader would get from react-native-web.
    Pressable: ({ children, role, accessibilityLabel, onPress }: Props) =>
      React.createElement(
        "button",
        {
          type: "button",
          onClick: onPress,
          ...domProps(role ?? "button", accessibilityLabel),
        },
        children,
      ),
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

async function render(card: GiftCardData, onPress?: () => void) {
  await act(async () => {
    host.render(<WishCard gift={card} width={343} onPress={onPress} />);
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
 * Story 2.2: the card stays presentational — the list passes `onPress` to open the
 * edit route, and only then is the content a button. The listitem wrapper stays
 * outside either way, so a non-owner list can reuse the card without a handler.
 */
describe("WishCard: нажатие", () => {
  it("с onPress контент — кнопка с подписью «Изменить «{title}»» и зовёт onPress", async () => {
    const onPress = vi.fn();
    await render(gift({ title: "Наушники" }), onPress);

    const item = container.querySelector('[role="listitem"]');
    expect(item).not.toBeNull();
    const card = item?.querySelector('[role="button"]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute("aria-label")).toBe("Изменить «Наушники»");

    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("без onPress карточка не кнопка, но listitem остаётся", async () => {
    await render(gift({ title: "Свитер" }));

    expect(container.querySelector('[role="listitem"]')).not.toBeNull();
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(textNodes()).toContain("Свитер");
  });
});
