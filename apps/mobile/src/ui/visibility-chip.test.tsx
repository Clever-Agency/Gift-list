// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors, spacing } from "@gift-list/ui";
import { VisibilityChip } from "@/ui/visibility-chip";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The same catalogue the app ships, so the word is asserted without a copy of it. */
const app = JSON.parse(
  readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
) as {
  gift: {
    visibility: Record<GiftCard["visibility"], string>;
    visibilityLower: Record<GiftCard["visibility"], string>;
    visibilityChipLabel: string;
  };
};
const labels = app.gift.visibility;

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

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(
          namespace
            .split(".")
            .slice(1)
            .reduce<unknown>(
              (node, part) =>
                typeof node === "object" && node !== null
                  ? (node as Record<string, unknown>)[part]
                  : undefined,
              app,
            ),
          key,
          values,
        ),
  };
});

vi.mock("expo-symbols", async () => {
  const React = await import("react");
  type Name = string | { ios?: string; android?: string; web?: string };
  return {
    /**
     * `expo-symbols` loads a symbol font at runtime; here the props it receives are
     * rendered as data attributes, which is what the chip promises the caller.
     */
    SymbolView: ({
      name,
      size,
      tintColor,
    }: {
      name: Name;
      size?: number;
      tintColor?: string;
    }) => {
      const platforms = typeof name === "string" ? { ios: name, android: name, web: name } : name;
      return React.createElement("span", {
        "data-testid": "visibility-icon",
        "data-ios": platforms.ios,
        "data-android": platforms.android,
        "data-size": String(size),
        "data-tint": tintColor,
      });
    },
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

async function render(visibility: GiftCard["visibility"], onPress?: () => void) {
  await act(async () => {
    host.render(<VisibilityChip visibility={visibility} onPress={onPress} />);
  });
  return container.querySelector('[data-testid="visibility-icon"]');
}

/** `DESIGN.md` → components `visibility-chip-*.icon`: globe / users / lock. */
describe("VisibilityChip: иконка и слово", () => {
  it.each([
    { visibility: "PUBLIC", ios: "globe", android: "public", tint: colors.primary },
    { visibility: "FRIENDS", ios: "person.2", android: "group", tint: colors.foreground },
    { visibility: "SECRET", ios: "lock", android: "lock", tint: colors["muted-foreground"] },
  ] as const)("$visibility: иконка и подпись", async ({ visibility, ios, android, tint }) => {
    const icon = await render(visibility);

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("data-ios")).toBe(ios);
    expect(icon?.getAttribute("data-android")).toBe(android);
    // Size and colour come from the theme tokens, not from a literal.
    expect(icon?.getAttribute("data-size")).toBe(String(spacing["icon-small"]));
    expect(icon?.getAttribute("data-tint")).toBe(tint);

    // The word stays: it is the label, the icon is decorative.
    expect(container.textContent).toBe(labels[visibility]);
  });

  it("иконка скрыта от диктора: не дублирует подпись", async () => {
    const icon = await render("PUBLIC");

    expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

/**
 * `DESIGN.md` → VisibilityChip: on an `OPEN` wish the chip is a button
 * (`aria-haspopup="dialog"`, «Видимость: всем. Изменить»); otherwise it only
 * shows the value.
 */
describe("VisibilityChip: нажатие", () => {
  it("без onPress чип не кнопка", async () => {
    await render("PUBLIC");

    expect(container.querySelector("button, [role='button']")).toBeNull();
  });

  it("с onPress — кнопка с подписью «Видимость: всем. Изменить», нажатие зовёт onPress", async () => {
    const onPress = vi.fn();
    await render("PUBLIC", onPress);

    const button = container.querySelector("[role='button']");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button?.getAttribute("aria-label")).toBe(
      app.gift.visibilityChipLabel.replace("{value}", app.gift.visibilityLower.PUBLIC),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
