// @vitest-environment happy-dom
import { act, cloneElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallHint, useInstallHint } from "@/ui/install-hint";
import { INSTALL_HINT_DISMISSED_KEY } from "@/ui/install-hint-storage";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
  Link: function Link({
    href,
    asChild,
    children,
  }: {
    href: string;
    asChild?: boolean;
    children: ReactElement<Record<string, unknown>>;
  }) {
    if (!asChild) return <a href={href}>{children}</a>;
    return cloneElement(children, { href });
  },
}));
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
  }

  function catalogFor(namespace: string): unknown {
    const parts = namespace.split(".");
    if (parts[0] === "app") parts.shift();
    return parts.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      app,
    );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string) => lookup(catalogFor(namespace), key),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

/** The screen shape: the hint stays mounted only while the hook says it is open. */
function Harness({ testID = "install-hint" }: { testID?: string }) {
  const hint = useInstallHint();
  return (
    <>
      {hint.visible ? <InstallHint onClose={hint.dismiss} testID={testID} /> : null}
      <button type="button">Дальше</button>
    </>
  );
}

Harness.displayName = "Harness";

async function mount(node = <Harness />) {
  await act(async () => root.render(node));
  await settle(0);
}

async function settle(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function press(node: Element | null) {
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function hint(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="install-hint"]');
}

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});

describe("подсказка «Установите приложение»", () => {
  it("рисует текст и крестик «Закрыть подсказку», а без адресов — ни одной ссылки", async () => {
    vi.stubEnv("EXPO_PUBLIC_ANDROID_STORE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_IOS_STORE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_IOS_APP_PUBLISHED", "");
    await mount();

    expect(hint()?.textContent).toContain("Установите приложение: поиск друзей по контактам");
    expect(container.querySelector('[aria-label="Закрыть подсказку"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="install-hint-android"]')).toBeNull();
    expect(container.querySelector('[data-testid="install-hint-ios"]')).toBeNull();
  });

  it("показывает Google Play при https-адресе и не угадывает адрес иначе", async () => {
    vi.stubEnv("EXPO_PUBLIC_ANDROID_STORE_URL", "https://play.google.com/store/apps/details?id=app.giftlist.mobile");
    await mount();

    const android = container.querySelector<HTMLAnchorElement>('[data-testid="install-hint-android"]');
    expect(android).not.toBeNull();
    expect(android?.getAttribute("href")).toBe(
      "https://play.google.com/store/apps/details?id=app.giftlist.mobile",
    );
    expect(android?.textContent).toBe("Google Play");
  });

  it("показывает App Store только при IOS_APP_PUBLISHED=true и заданном адресе", async () => {
    vi.stubEnv("EXPO_PUBLIC_IOS_STORE_URL", "https://apps.apple.com/app/id000000000");
    await mount();
    expect(container.querySelector('[data-testid="install-hint-ios"]')).toBeNull();

    vi.stubEnv("EXPO_PUBLIC_IOS_APP_PUBLISHED", "true");
    await mount();
    const ios = container.querySelector<HTMLAnchorElement>('[data-testid="install-hint-ios"]');
    expect(ios?.getAttribute("href")).toBe("https://apps.apple.com/app/id000000000");
    expect(ios?.textContent).toBe("App Store");
  });

  it("без адреса App Store не появляется даже при включённом флаге", async () => {
    vi.stubEnv("EXPO_PUBLIC_IOS_APP_PUBLISHED", "true");
    vi.stubEnv("EXPO_PUBLIC_IOS_STORE_URL", "");
    await mount();

    expect(container.querySelector('[data-testid="install-hint-ios"]')).toBeNull();
  });

  it("крестик закрывает подсказку, запоминает это и уводит фокус на следующий элемент", async () => {
    await mount();
    const close = container.querySelector<HTMLElement>('[aria-label="Закрыть подсказку"]');
    expect(close).not.toBeNull();

    await press(close);
    await settle(10);

    expect(hint()).toBeNull();
    expect(window.localStorage.getItem(INSTALL_HINT_DISMISSED_KEY)).toBe("1");
    const next = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent === "Дальше",
    );
    expect(document.activeElement).toBe(next);
  });

  it("закрытие на одном экране скрывает подсказку и на другом открытом", async () => {
    await mount(
      <>
        <Harness testID="install-hint-one" />
        <Harness testID="install-hint-two" />
      </>,
    );
    const first = container.querySelector<HTMLElement>('[data-testid="install-hint-one"]');
    expect(first).not.toBeNull();
    expect(container.querySelector('[data-testid="install-hint-two"]')).not.toBeNull();

    await press(
      first?.querySelector('[aria-label="Закрыть подсказку"]') ?? null,
    );
    await settle(10);

    expect(hint()).toBeNull();
    expect(container.querySelector('[data-testid="install-hint-one"]')).toBeNull();
    expect(container.querySelector('[data-testid="install-hint-two"]')).toBeNull();
  });

  it("повторный заход в этом браузере подсказку не показывает", async () => {
    window.localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, "1");
    await mount();

    expect(hint()).toBeNull();
  });
});
