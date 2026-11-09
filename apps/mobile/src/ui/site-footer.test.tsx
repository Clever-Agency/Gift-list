// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/ui/site-footer";

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const common = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/common.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
  }

  return {
    useTranslations: (namespace: string) => (key: string) =>
      lookup(namespace === "common" ? common : {}, key),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SiteFooter", () => {
  it("один contentinfo-футер с подписью агентства и ссылкой «Написать автору»", async () => {
    await act(async () => {
      root.render(<SiteFooter />);
    });

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");
    expect(footer?.textContent).toContain("Написать автору");
  });

  it("действия страницы стоят внутри того же футера", async () => {
    await act(async () => {
      root.render(
        <SiteFooter actions={<button type="button">Выйти</button>} />,
      );
    });

    const actions = container.querySelector<HTMLElement>('[data-testid="page-footer-actions"]');
    expect(actions).not.toBeNull();
    expect(actions?.textContent).toContain("Выйти");
    expect(actions?.closest('[data-testid="page-footer"]')).not.toBeNull();
  });
});
