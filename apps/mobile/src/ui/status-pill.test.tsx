// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as { gift: { status: Record<string, string> } };

  return {
    // `app.gift.status` -> `app.gift.status[<key>]`.
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

/**
 * `DESIGN.md` -> components -> StatusPill: the status is always spelled out and the
 * pill is not a control. The look (tones) is `StatusPill` of `@gift-list/ui`; here the
 * wire status maps to the catalogue word.
 */
describe("StatusPill: подпись по статусу", () => {
  it.each(["OPEN", "RESERVED", "CLOSED"] as const)("%s: подпись словом, не кнопка", async (status) => {
    await act(async () => {
      host.render(<StatusPill status={status} />);
    });

    expect(container.textContent).toBe(labels[status]);
    // Purely informational: nothing to press or focus.
    expect(container.querySelectorAll("button, [role='button'], [tabindex]")).toHaveLength(0);
  });
});
