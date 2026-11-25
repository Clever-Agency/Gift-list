import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientResult } from "@/api/client";
import {
  INITIAL_APP_VERSION_STATE,
  attemptAppVersionCheck,
  createAppVersionChecker,
  resolveAppVersion,
  type AppVersionCheck,
  type AppVersionDeps,
  type AppVersionState,
} from "@/app-version/check";

const store = vi.hoisted(() => ({
  readDismissedVersion: vi.fn(),
  writeDismissedVersion: vi.fn(),
}));

vi.mock("@/app-version/dismissed", () => store);
vi.mock("@/api/app-version", () => ({ fetchAppVersionPolicy: vi.fn() }));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "0.1.0" } },
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const androidPolicy = {
  latestVersion: "0.2.0",
  minSupportedVersion: "0.1.0",
  storeUrl: null,
};

const iosPolicy = {
  latestVersion: "0.3.0",
  minSupportedVersion: "0.1.0",
  storeUrl: "https://apps.apple.com/app/id1",
};

function policyData() {
  return { android: androidPolicy, ios: iosPolicy };
}

function blockingData() {
  return {
    android: {
      latestVersion: "0.3.0",
      minSupportedVersion: "0.2.0",
      storeUrl: null,
    },
    ios: iosPolicy,
  };
}

function deps(overrides: Partial<AppVersionDeps> = {}): AppVersionDeps {
  return {
    platform: () => "android",
    currentVersion: () => "0.1.0",
    fetchPolicy: vi.fn(async function fetchPolicy() {
      return { ok: true as const, data: policyData() };
    }),
    readDismissedVersion: vi.fn(async function readDismissedVersion() {
      return null;
    }),
    ...overrides,
  };
}

function check(overrides: Partial<Extract<AppVersionCheck, { ok: true }>> = {}): AppVersionCheck {
  return {
    ok: true,
    data: policyData(),
    platform: "android",
    currentVersion: "0.1.0",
    dismissedVersion: null,
    ...overrides,
  };
}

const blockState: AppVersionState = {
  status: "block",
  latestVersion: "0.3.0",
  storeUrl: null,
};

beforeEach(() => {
  store.readDismissedVersion.mockReset();
  store.writeDismissedVersion.mockReset();
  store.readDismissedVersion.mockResolvedValue(null);
  store.writeDismissedVersion.mockResolvedValue(undefined);
});

describe("resolveAppVersion", () => {
  it("предлагает обновиться ниже latest", () => {
    expect(resolveAppVersion(INITIAL_APP_VERSION_STATE, check())).toEqual({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
  });

  it("блокирует ниже min", () => {
    expect(
      resolveAppVersion(
        INITIAL_APP_VERSION_STATE,
        check({ data: blockingData(), currentVersion: "0.1.0" }),
      ),
    ).toEqual({
      status: "block",
      latestVersion: "0.3.0",
      storeUrl: null,
    });
  });

  it("ничего не показывает на latest", () => {
    expect(
      resolveAppVersion(INITIAL_APP_VERSION_STATE, check({ currentVersion: "0.2.0" })),
    ).toEqual(INITIAL_APP_VERSION_STATE);
  });

  it("ничего не показывает, если сборка впереди политики", () => {
    expect(
      resolveAppVersion(INITIAL_APP_VERSION_STATE, check({ currentVersion: "0.3.0" })),
    ).toEqual(INITIAL_APP_VERSION_STATE);
  });

  it("берёт ветку своей платформы", () => {
    expect(
      resolveAppVersion(INITIAL_APP_VERSION_STATE, check({ currentVersion: "0.2.0" })),
    ).toEqual(INITIAL_APP_VERSION_STATE);

    expect(
      resolveAppVersion(
        INITIAL_APP_VERSION_STATE,
        check({ platform: "ios", currentVersion: "0.2.0" }),
      ),
    ).toEqual({
      status: "soft",
      latestVersion: "0.3.0",
      storeUrl: "https://apps.apple.com/app/id1",
    });
  });

  it("не повторяет предложение закрытой версии", () => {
    expect(
      resolveAppVersion(INITIAL_APP_VERSION_STATE, check({ dismissedVersion: "0.2.0" })),
    ).toEqual(INITIAL_APP_VERSION_STATE);
  });

  it("предлагает новую версию после закрытой", () => {
    expect(
      resolveAppVersion(INITIAL_APP_VERSION_STATE, check({ currentVersion: "0.1.5" })),
    ).toEqual({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
    expect(
      resolveAppVersion(
        INITIAL_APP_VERSION_STATE,
        check({ currentVersion: "0.1.5", dismissedVersion: "0.2.0" }),
      ),
    ).toEqual(INITIAL_APP_VERSION_STATE);
  });

  it("блок сильнее запоминания", () => {
    expect(
      resolveAppVersion(
        INITIAL_APP_VERSION_STATE,
        check({ data: blockingData(), currentVersion: "0.1.0", dismissedVersion: "0.2.0" }),
      ),
    ).toEqual({
      status: "block",
      latestVersion: "0.3.0",
      storeUrl: null,
    });
  });

  it("ошибка проверки не снимает блок", () => {
    expect(resolveAppVersion(blockState, { ok: false })).toEqual(blockState);
  });

  it("ошибка проверки не трогает текущее состояние", () => {
    const softState: AppVersionState = {
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    };

    expect(resolveAppVersion(softState, { ok: false })).toEqual(softState);
  });
});

describe("attemptAppVersionCheck", () => {
  it("возвращает проверенный ответ своей платформы", async () => {
    await expect(attemptAppVersionCheck(deps())).resolves.toEqual({
      ok: true,
      data: policyData(),
      platform: "android",
      currentVersion: "0.1.0",
      dismissedVersion: null,
    });
  });

  it("не делает запрос на вебе", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: false as const, network: true as const };
    });
    await expect(
      attemptAppVersionCheck(deps({ platform: () => null, fetchPolicy })),
    ).resolves.toEqual({ ok: false });
    expect(fetchPolicy).not.toHaveBeenCalled();
  });

  it("не делает запрос без читаемой версии клиента", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: false as const, network: true as const };
    });
    await expect(
      attemptAppVersionCheck(deps({ currentVersion: () => null, fetchPolicy })),
    ).resolves.toEqual({ ok: false });
    expect(fetchPolicy).not.toHaveBeenCalled();
  });

  it("не делает запрос на невалидной версии клиента", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: false as const, network: true as const };
    });
    await expect(
      attemptAppVersionCheck(deps({ currentVersion: () => "1.0", fetchPolicy })),
    ).resolves.toEqual({ ok: false });
    expect(fetchPolicy).not.toHaveBeenCalled();
  });

  it("fails open на сетевой ошибке", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: false as const, network: true as const };
    });

    await expect(attemptAppVersionCheck(deps({ fetchPolicy }))).resolves.toEqual({
      ok: false,
    });
  });

  it("fails open на конверте ошибки", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: false as const, code: "NOT_FOUND" as const, message: "Not found" };
    });

    await expect(attemptAppVersionCheck(deps({ fetchPolicy }))).resolves.toEqual({
      ok: false,
    });
  });

  it("fails open, когда ответ не проходит схему", async () => {
    const bodies: unknown[] = [
      { android: androidPolicy },
      { android: { ...androidPolicy, latestVersion: "1.0" }, ios: iosPolicy },
      {
        android: { ...androidPolicy, minSupportedVersion: "0.3.0" },
        ios: iosPolicy,
      },
      {
        android: { ...androidPolicy, storeUrl: "ftp://example.com/app" },
        ios: iosPolicy,
      },
    ];

    for (const body of bodies) {
      const fetchPolicy = vi.fn(async function fetchPolicy() {
        return { ok: true as const, data: body };
      });

      await expect(attemptAppVersionCheck(deps({ fetchPolicy }))).resolves.toEqual({
        ok: false,
      });
    }
  });

  it("не скрывает предложение из-за сломанного хранилища", async () => {
    await expect(
      attemptAppVersionCheck(
        deps({
          readDismissedVersion: async function readDismissedVersion() {
            throw new Error("locked");
          },
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      data: policyData(),
      platform: "android",
      currentVersion: "0.1.0",
      dismissedVersion: null,
    });
  });
});

describe("createAppVersionChecker", () => {
  it("применяет ответ и сообщает состояние", async () => {
    const onState = vi.fn();
    const checker = createAppVersionChecker({ deps: deps(), onState });

    await expect(checker.check()).resolves.toEqual({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
    expect(onState).toHaveBeenCalledWith({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
    expect(checker.getState()).toEqual({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
  });

  it("не дублирует запрос при быстром возврате на передний план", async () => {
    let resolvePolicy: ((value: ClientResult<unknown>) => void) | undefined;
    const fetchPolicy = vi.fn(function fetchPolicy() {
      return new Promise<ClientResult<unknown>>(function executor(resolve) {
        resolvePolicy = resolve;
      });
    });
    const checker = createAppVersionChecker({
      deps: deps({ fetchPolicy }),
    });

    const first = checker.check();
    const second = checker.check();
    expect(fetchPolicy).toHaveBeenCalledTimes(1);

    resolvePolicy?.({ ok: true, data: policyData() });
    await Promise.all([first, second]);

    expect(fetchPolicy).toHaveBeenCalledTimes(1);
    expect(checker.getState()).toEqual({
      status: "soft",
      latestVersion: "0.2.0",
      storeUrl: null,
    });
  });

  it("не снимает блок упавшей проверкой", async () => {
    const fetchPolicy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: blockingData() })
      .mockResolvedValueOnce({ ok: false, network: true });
    const checker = createAppVersionChecker({ deps: deps({ fetchPolicy }) });

    await checker.check();
    expect(checker.getState().status).toBe("block");

    await checker.check();
    expect(checker.getState()).toEqual(blockState);
  });

  it("закрытие запоминает latestVersion и убирает предложение", async () => {
    const onState = vi.fn();
    const checker = createAppVersionChecker({ deps: deps(), onState });

    await checker.check();
    await expect(checker.dismiss()).resolves.toEqual(INITIAL_APP_VERSION_STATE);

    expect(store.writeDismissedVersion).toHaveBeenCalledWith("0.2.0");
    expect(onState).toHaveBeenLastCalledWith(INITIAL_APP_VERSION_STATE);
  });

  it("не повторяет предложение после закрытия до смены latestVersion", async () => {
    const fetchPolicy = vi.fn(async function fetchPolicy() {
      return { ok: true as const, data: policyData() };
    });
    const checker = createAppVersionChecker({ deps: deps({ fetchPolicy }) });

    await checker.check();
    await checker.dismiss();
    // The stored value is still null in this test: the session itself must hold the dismissal.
    await checker.check();
    expect(checker.getState()).toEqual(INITIAL_APP_VERSION_STATE);

    fetchPolicy.mockResolvedValue({
      ok: true,
      data: {
        android: { ...androidPolicy, latestVersion: "0.3.0" },
        ios: iosPolicy,
      },
    });
    await checker.check();
    expect(checker.getState()).toEqual({
      status: "soft",
      latestVersion: "0.3.0",
      storeUrl: null,
    });
  });

  it("блок нельзя закрыть", async () => {
    const checker = createAppVersionChecker({
      deps: deps({
        fetchPolicy: vi.fn(async function fetchPolicy() {
          return { ok: true as const, data: blockingData() };
        }),
      }),
    });

    await checker.check();
    await checker.dismiss();

    expect(checker.getState().status).toBe("block");
    expect(store.writeDismissedVersion).not.toHaveBeenCalled();
  });

  it("ошибка записи не мешает закрыть предложение", async () => {
    store.writeDismissedVersion.mockRejectedValue(new Error("no space"));
    const checker = createAppVersionChecker({ deps: deps() });

    await checker.check();
    await expect(checker.dismiss()).resolves.toEqual(INITIAL_APP_VERSION_STATE);
    expect(checker.getState()).toEqual(INITIAL_APP_VERSION_STATE);
  });
});
