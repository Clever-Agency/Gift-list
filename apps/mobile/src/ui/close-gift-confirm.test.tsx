// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controls, dialogElement } from "@/test/dom";
import { declarationsFor } from "@/test/tamagui-css";
import { CloseGiftConfirm } from "@/ui/close-gift-confirm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The close cross of the discard step draws a symbol; the confirm mode has none,
// but the module is imported anyway.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  function SymbolView() {
    return React.createElement("span", { "data-testid": "symbol" });
  }
  return { SymbolView };
});

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
    title: "Свитер",
    description: null,
    priceAmount: null,
    priceCurrency: null,
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

async function render({
  target = gift(),
  busy,
  onConfirm = function noop() {},
  onCancel = function noop() {},
}: {
  target?: GiftCard | null;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
} = {}) {
  await act(async () => {
    host.render(
      <CloseGiftConfirm
        gift={target}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onClosed={function noop() {}}
      />,
    );
  });
}

function button(label: string): HTMLElement {
  const node = controls(dialogElement() ?? document).find(function sameLabel(item) {
    return (item.textContent ?? "").trim() === label;
  });
  expect(node, `кнопка «${label}»`).toBeDefined();
  return node as HTMLElement;
}

function baseBackground(node: Element): string | undefined {
  const found = declarationsFor(node, "background-color").filter(
    (one) => !one.selector.includes(":where("),
  );
  return found.length > 0 ? found[found.length - 1].value : undefined;
}

/**
 * Story 5.3 (FR-32): «Подарок «Y» получен?» перед закрытием. D-49 (CLE-124): один
 * текст для всех желаний — владелец не знает о брони, слова «Бронь» нет. Кнопка
 * подтверждения обычная, не коралловая (`DESIGN.md` → Colors: `destructive` не
 * для «закрыт»).
 */
describe("CloseGiftConfirm: подтверждение закрытия желания", () => {
  it("открытое желание: вопрос с названием, без слова «Бронь»", async () => {
    await render();

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Подарок «Свитер» получен?");
    expect(dialog?.textContent).not.toContain("Бронь");
    expect(dialog?.textContent).toContain("Подтвердить");
    expect(dialog?.textContent).toContain("Отмена");
  });

  it("забронированное желание: то же подтверждение, без слова «Бронь»", async () => {
    await render({ target: gift({ status: "RESERVED" }) });

    expect(dialogElement()?.textContent).toContain("Подарок «Свитер» получен?");
    expect(dialogElement()?.textContent).not.toContain("Бронь");
    expect(dialogElement()?.textContent).not.toContain("бронировавший");
  });

  it("кнопка подтверждения обычная (primary), а не коралловая", async () => {
    await render();

    expect(baseBackground(button("Подтвердить"))).toBe("var(--primary)");
    expect(baseBackground(button("Подтвердить"))).not.toBe("var(--destructive)");
  });

  it("фокус при открытии — на безопасной «Отмене»", async () => {
    await render();

    expect(document.activeElement).toBe(button("Отмена"));
  });

  it("одно нажатие — один onConfirm; «Отмена» не подтверждает", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    await render({ onConfirm, onCancel });

    await act(async () => button("Подтвердить").click());
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => button("Отмена").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("busy: подтверждение занято и второй раз не уходит", async () => {
    const onConfirm = vi.fn();
    await render({ busy: true, onConfirm });

    const confirm = button("Подтвердить");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    await act(async () => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("без желания слой не рисуется", async () => {
    await render({ target: null });

    expect(dialogElement()).toBeNull();
  });
});
