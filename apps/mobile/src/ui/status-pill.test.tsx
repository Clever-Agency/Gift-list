// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors } from "@/theme/tokens";
import { StatusPill } from "@/ui/status-pill";

/** The same catalogue the app ships, so the words are asserted without a copy of them. */
const catalogPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "packages/contracts/src/i18n/ru/app.json",
);
const labels = (
  JSON.parse(readFileSync(catalogPath, "utf8")) as {
    gift: { status: Record<GiftCard["status"], string> };
  }
).gift.status;

const ui = vi.hoisted(() => ({
  views: [] as { style: unknown }[],
  texts: [] as { value: string; style: unknown }[],
}));

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as { gift: { status: Record<string, string> } };

  return {
    // `app.gift.status` → `app.gift.status[<key>]`.
    useTranslations: (namespace: string) => (key: string) => {
      const node = namespace
        .split(".")
        .slice(1)
        .reduce<unknown>(
          (current, part) =>
            typeof current === "object" && current !== null
              ? (current as Record<string, unknown>)[part]
              : undefined,
          app,
        );
      return (node as Record<string, string> | undefined)?.[key] ?? key;
    },
  };
});

vi.mock("react-native", async () => {
  const React = await import("react");
  type Props = { children?: React.ReactNode; style?: unknown };
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    View: ({ children, style }: Props) => {
      ui.views.push({ style });
      return React.createElement("div", null, children);
    },
    Text: ({ children, style }: Props) => {
      if (typeof children === "string") ui.texts.push({ value: children, style });
      return React.createElement("span", null, children);
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  ui.views.length = 0;
  ui.texts.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render(status: GiftCard["status"]) {
  await act(async () => {
    host.render(<StatusPill status={status} />);
  });
}

/**
 * `DESIGN.md` → components → StatusPill: the status is always spelled out, open and
 * closed sit on `muted`, reserved gets its own tint. The pill is not a control.
 */
describe("StatusPill: подпись и тон по статусу", () => {
  it.each([
    { status: "OPEN" as const, background: colors.muted, text: colors["status-open"] },
    {
      status: "RESERVED" as const,
      background: colors["status-reserved-bg"],
      text: colors["status-reserved"],
    },
    { status: "CLOSED" as const, background: colors.muted, text: colors["status-closed"] },
  ])("$status: подпись словом и своим тоном", async ({ status, background, text }) => {
    await render(status);

    const label = ui.texts.at(-1);
    expect(label?.value).toBe(labels[status]);
    expect(flattenStyle(ui.views.at(-1)?.style).backgroundColor).toBe(background);
    expect(flattenStyle(label?.style).color).toBe(text);

    // Purely informational: no button, no press handler.
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
