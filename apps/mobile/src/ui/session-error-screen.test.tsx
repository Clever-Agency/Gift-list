// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionErrorScreen } from "@/ui/session-error-screen";

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

vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

async function mount(element: ReactNode) {
  await act(async () => {
    root.render(element);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SessionErrorScreen", () => {
  it("одна прокрутка страницы, alert-регион и кнопка «Повторить»", async () => {
    const retry = vi.fn();
    await mount(<SessionErrorScreen onRetry={retry} />);

    const page = container.querySelector<HTMLElement>('[data-testid="session-error-page"]');
    expect(page).not.toBeNull();
    expect(getComputedStyle(page as Element).overflowY).toBe("auto");

    const region = container.querySelector<HTMLElement>('[data-testid="session-error"]');
    expect(region?.getAttribute("role")).toBe("alert");
    expect(region?.getAttribute("aria-live")).toBe("assertive");
    expect(region?.textContent).toContain("Нет связи с сервером");
    expect(region?.textContent).toContain("Проверьте сеть");

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");

    const scrollers = Array.from(container.querySelectorAll("*")).filter((node) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
    );
    expect(scrollers).toEqual([page]);
  });

  it("«Повторить» вызывает переданный обработчик", async () => {
    const retry = vi.fn();
    await mount(<SessionErrorScreen onRetry={retry} />);

    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      (node.textContent ?? "").includes("Повторить"),
    );
    expect(button).toBeDefined();
    await act(async () => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("форма: тот же стабильный testID", async () => {
    await mount(<SessionErrorScreen size="form" onRetry={vi.fn()} />);
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();
  });
});
