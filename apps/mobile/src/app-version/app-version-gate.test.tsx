// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByLabel, controlByText, controls, dialogElement, settle } from "@/test/dom";
import { AppVersionGate as WebAppVersionGate } from "@/app-version/app-version-gate";
import { AppVersionGate } from "@/app-version/app-version-gate.native";

/**
 * CLE-86: the gate itself, not the rule. The decision and the request live in
 * `@/app-version/check` (its own test covers the matrix); here the gate is
 * mounted against a stubbed network, build version, platform, dismissal store
 * and foreground source, and the two screens it draws are checked as a person
 * meets them: the offer over the running app and the blocking page instead of it.
 *
 * The web twin is mounted as well: the browser build must draw its children and
 * send nothing.
 */

const harness = vi.hoisted(() => ({
  fetchPolicy: vi.fn(),
  readDismissed: vi.fn(),
  writeDismissed: vi.fn(),
  openURL: vi.fn(),
  /** The subscriptions the gate made; a test calls one to fake a return to the app. */
  onActive: [] as (() => void)[],
  unsubscribe: vi.fn(),
}));

vi.mock("@/api/app-version", () => ({ fetchAppVersionPolicy: harness.fetchPolicy }));
vi.mock("@/app-version/platform", () => ({ appVersionPlatform: () => "android" }));
vi.mock("@/app-version/current-version", () => ({ currentAppVersion: () => "0.1.0" }));
vi.mock("@/app-version/dismissed", () => ({
  readDismissedVersion: harness.readDismissed,
  writeDismissedVersion: harness.writeDismissed,
}));
vi.mock("@/app-version/foreground", () => ({
  subscribeForeground: (onActive: () => void) => {
    harness.onActive.push(onActive);
    return harness.unsubscribe;
  },
}));
vi.mock("expo-linking", () => ({ openURL: harness.openURL }));

/** The copy is the app's own catalogue, so the assertions are not a second copy of it. */
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;

  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      head === "app" ? app : undefined,
    );
  }

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
      lookup(catalogFor(namespace), key),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type PlatformPolicy = {
  latestVersion: string;
  minSupportedVersion: string;
  storeUrl: string | null;
};

function samePolicy(overrides: Partial<PlatformPolicy> = {}): {
  android: PlatformPolicy;
  ios: PlatformPolicy;
} {
  const policy: PlatformPolicy = {
    latestVersion: "0.2.0",
    minSupportedVersion: "0.1.0",
    storeUrl: null,
    ...overrides,
  };
  return { android: policy, ios: policy };
}

function blockingPolicy(overrides: Partial<PlatformPolicy> = {}) {
  return samePolicy({ latestVersion: "0.3.0", minSupportedVersion: "0.2.0", ...overrides });
}

function answered(data: unknown) {
  return { ok: true as const, data };
}

const STORE_URL = "https://play.google.com/store/apps/details?id=example.giftlist";

let host: Root;
let container: HTMLDivElement;

async function mount(element: ReactNode) {
  await act(async () => {
    host.render(element);
  });
  // One request and its answer settle on timers of the layer and of the promise.
  await settle();
}

function screen() {
  return container.querySelector<HTMLElement>('[data-testid="app"]');
}

beforeEach(() => {
  harness.fetchPolicy.mockReset();
  harness.readDismissed.mockReset();
  harness.writeDismissed.mockReset();
  harness.openURL.mockReset();
  harness.onActive.length = 0;
  harness.unsubscribe.mockReset();
  harness.readDismissed.mockResolvedValue(null);
  harness.writeDismissed.mockResolvedValue(undefined);
  harness.openURL.mockResolvedValue(undefined);

  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

describe("AppVersionGate: мягкое предложение", () => {
  it("рисует приложение и закрываемое предложение без кнопки магазина", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    expect(screen()).not.toBeNull();
    const layer = dialogElement();
    expect(layer?.getAttribute("role")).toBe("dialog");
    expect(layer?.textContent).toContain("Доступно обновление");
    expect(layer?.textContent).toContain("Вышла новая версия приложения");
    // `storeUrl = null`: nothing to open, so no invented store address.
    expect(controlByText("Обновить")).toBeUndefined();
    expect(controlByText("Закрыть")).toBeDefined();
  });

  it("«Закрыть» убирает предложение и запоминает версию", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    await click(controlByText("Закрыть"));
    await settle(400);

    expect(harness.writeDismissed).toHaveBeenCalledWith("0.2.0");
    expect(dialogElement()).toBeNull();
    expect(screen()).not.toBeNull();
  });

  it("крестик закрывает так же, как кнопка", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    const cross = controlByLabel("Закрыть");
    expect(cross).toBeDefined();
    await click(cross);
    await settle(400);

    expect(harness.writeDismissed).toHaveBeenCalledWith("0.2.0");
    expect(dialogElement()).toBeNull();
  });

  it("закрытая версия не предлагается снова", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy()));
    harness.readDismissed.mockResolvedValue("0.2.0");

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    expect(dialogElement()).toBeNull();
    expect(screen()).not.toBeNull();
  });
});

describe("AppVersionGate: ссылка в магазин", () => {
  it("«Обновить» открывает ссылку из ответа", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy({ storeUrl: STORE_URL })));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    await click(controlByText("Обновить"));

    expect(harness.openURL).toHaveBeenCalledWith(STORE_URL);
  });

  it("отказ openURL не ломает экран", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(samePolicy({ storeUrl: STORE_URL })));
    harness.openURL.mockRejectedValue(new Error("no store app"));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    await click(controlByText("Обновить"));

    expect(dialogElement()).not.toBeNull();
    expect(screen()).not.toBeNull();
  });
});

describe("AppVersionGate: блокирующий экран", () => {
  it("заменяет приложение и не даёт себя закрыть", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(blockingPolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    // No app tree under the block: no route, no navigation, nothing to go back to.
    expect(screen()).toBeNull();
    expect(dialogElement()).toBeNull();

    const region = container.querySelector<HTMLElement>('[data-testid="app-update-block"]');
    expect(region?.getAttribute("role")).toBe("alert");
    expect(region?.getAttribute("aria-live")).toBe("assertive");
    expect(region?.textContent).toContain("Обновите приложение");
    // `storeUrl = null`: the dead end agreed before the stores are published.
    expect(region?.textContent).toContain(
      "Эта версия больше не поддерживается. Обновите приложение в магазине.",
    );
    expect(controls(region as HTMLElement)).toEqual([]);
  });

  it("фокус уходит в предупреждающую область, заголовок первого уровня на месте", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(blockingPolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    const region = container.querySelector<HTMLElement>('[data-testid="app-update-block"]');
    expect(region?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(region);

    const heading = container.querySelector('[role="heading"]');
    expect(heading?.getAttribute("aria-level")).toBe("1");
    expect(heading?.textContent).toBe("Обновите приложение");
  });

  it("кнопка магазина открывает ссылку из ответа", async () => {
    harness.fetchPolicy.mockResolvedValue(answered(blockingPolicy({ storeUrl: STORE_URL })));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    const region = container.querySelector<HTMLElement>('[data-testid="app-update-block"]');
    expect(region?.textContent).toContain("чтобы продолжить");

    await click(controlByText("Открыть магазин"));
    expect(harness.openURL).toHaveBeenCalledWith(STORE_URL);
  });

  it("упавшая проверка на переднем плане блок не снимает", async () => {
    harness.fetchPolicy
      .mockResolvedValueOnce(answered(blockingPolicy()))
      .mockResolvedValueOnce({ ok: false, network: true });

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    expect(container.querySelector('[data-testid="app-update-block"]')).not.toBeNull();

    await act(async () => {
      harness.onActive[0]?.();
    });
    await settle();

    expect(harness.fetchPolicy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="app-update-block"]')).not.toBeNull();
    expect(screen()).toBeNull();
  });
});

describe("AppVersionGate: fail open и передний план", () => {
  it("обрыв сети ничего не показывает", async () => {
    harness.fetchPolicy.mockResolvedValue({ ok: false, network: true });

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    expect(screen()).not.toBeNull();
    expect(dialogElement()).toBeNull();
  });

  it("невалидный ответ ничего не показывает", async () => {
    harness.fetchPolicy.mockResolvedValue(answered({ android: { latestVersion: "1.0" } }));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    expect(screen()).not.toBeNull();
    expect(dialogElement()).toBeNull();
  });

  it("возврат на передний план проверяет снова", async () => {
    harness.fetchPolicy
      .mockResolvedValueOnce(answered(samePolicy({ latestVersion: "0.1.0" })))
      .mockResolvedValueOnce(answered(blockingPolicy()));

    await mount(
      <AppVersionGate>
        <span data-testid="app" />
      </AppVersionGate>,
    );

    // Up to date: the app is just the app.
    expect(dialogElement()).toBeNull();
    expect(screen()).not.toBeNull();

    await act(async () => {
      harness.onActive[0]?.();
    });
    await settle();

    expect(harness.fetchPolicy).toHaveBeenCalledTimes(2);
    expect(screen()).toBeNull();
    expect(container.querySelector('[data-testid="app-update-block"]')).not.toBeNull();
  });
});

describe("AppVersionGate: веб", () => {
  it("рисует детей сразу и ничего не запрашивает", async () => {
    await mount(
      <WebAppVersionGate>
        <span data-testid="app" />
      </WebAppVersionGate>,
    );

    expect(screen()).not.toBeNull();
    expect(dialogElement()).toBeNull();
    expect(harness.fetchPolicy).not.toHaveBeenCalled();
    expect(harness.onActive).toEqual([]);
  });
});
